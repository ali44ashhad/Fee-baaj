// src/modules/courses/controller.ts
import { Request, Response } from 'express';
import { AppError, asyncHandler } from '@elearning/lib';
import { Chapter, Course, Enrollment, Instructor, Review, User, UserProgress, Reaction } from '@elearning/models';
import { ICourseResponse, IDataLoadedResponse, ILecture, STATUS_MESSAGES } from '@elearning/types';
import { ObjectId } from 'mongoose';
import { MEDIA_BASE_URL } from '@elearning/lib/dist/constants';
import { isValidObjectId } from 'mongoose';

/**
 * NOTE: This controller enforces that user-facing endpoints return only published courses.
 * - list, listPaid now include filter.published = true
 * - read returns course only if published === true, OR if the requester is:
 *     - the course instructor, OR
 *     - an enrolled user for that course
 */

export const read = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Build a query object: if `id` looks like a Mongo ObjectId, use `_id`;
  // otherwise assume it's a slug.
  const query = isValidObjectId(id) ? { _id: id } : { slug: id };

  const course = await Course.findOne(query);
  if (!course) {
    throw new AppError('Course not found', STATUS_MESSAGES.NOT_FOUND);
  }

  // Enforce published visibility for public users:
  // Allow access if course.published === true
  // OR if requester is authenticated AND either the course instructor OR already enrolled.
  if (!course.published) {
    const isAuthenticated = req.isAuthenticated();
    let allowed = false;

    if (isAuthenticated) {
      // allow if requester is instructor
      if (req.user && req.user._id && course.instructorId && req.user._id.toString() === course.instructorId.toString()) {
        allowed = true;
      } else {
        // allow if requester is enrolled
        const enrolledExists = await Enrollment.exists({ courseId: course._id, userId: req.user._id });
        if (enrolledExists) allowed = true;
      }
    }

    if (!allowed) {
      // hide existence for unpublished courses from unauthorized users
      throw new AppError('Course not found', STATUS_MESSAGES.NOT_FOUND);
    }
  }

  const chapters = await Chapter.find({ courseId: course._id }).sort({ order: 1 });

  const enrolled = req.isAuthenticated()
    ? await Enrollment.exists({ courseId: course._id, userId: req.user._id })
    : false;

  const userProgress = enrolled
    ? await UserProgress.findOne({ courseId: course._id, userId: req.user._id }, { lectures: 1 })
    : null;

  // Get all lectures sorted in order
  const allLectures = chapters.flatMap((chapter) => chapter.lectures);
  const totalLectures = allLectures.length;
  const completedLectures = userProgress ? userProgress.lectures.map((id) => id.toString()) : [];

  let currentLectureId = null;

  if (allLectures.length) {
    const lastCompletedIndex = allLectures.findIndex((lec) => completedLectures.includes(lec._id.toString()));

    if (lastCompletedIndex !== -1 && lastCompletedIndex + 1 < allLectures.length) {
      currentLectureId = allLectures[lastCompletedIndex + 1]._id; // Next lecture
    } else {
      currentLectureId = allLectures[allLectures.length - 1]._id; // Last lecture
    }
  }

  const progress = totalLectures ? (completedLectures.length / totalLectures) * 100 : 0;

  const enrollment = req.isAuthenticated()
    ? await Enrollment.findOne({ courseId: course._id, userId: req.user._id })
    : undefined;

  // -- reactions for single course
  const reactionsAgg = await Reaction.aggregate([
    { $match: { course: course._id } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  const reactions = { like: 0, love: 0, wow: 0, total: 0 };
  reactionsAgg.forEach((r: any) => {
    const type = r._id as string;
    if (type === 'like' || type === 'love' || type === 'wow') {
      reactions[type] = r.count;
      reactions.total += r.count;
    }
  });

  let userReaction: any = {};
  if (req.isAuthenticated()) {
    const ur = await Reaction.findOne({ course: course._id, user: req.user._id }).select('type -_id').lean();
    if (ur) {
      userReaction = { type: ur.type };
    }
  }

  return res.out({
    ...(course as any).toObject(),
    chapters: chapters.map((c) => ({
      ...c.toObject(),
      lectures: c.lectures.map((l) => ({
        title: l.title,
        duration: l.duration,
        completed: completedLectures.includes(l._id.toString()),
        video: l.video,
        videoPopups: l.videoPopups
      })),
    })),
    enrolled,
    currentLectureId,
    progress,
    enrollment,
    reactions,      // added
    userReaction,   // added
  });
});


export const listPaid = asyncHandler(async (req: Request, res: Response) => {
  if (req.query.enrolled == 'true' && !req.isAuthenticated()) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  // ✅ Only changed this line: include published filter to return only published courses
  let filter: any = { price: { $gt: 0 }, published: true };

  if (req.query.enrolled === 'true') {
    const enrolledCourses = await Enrollment.find({ userId: req.user._id }).select('courseId');
    const enrolledCourseIds = enrolledCourses.map((e) => e.courseId);

    if (enrolledCourseIds.length === 0) {
      return res.out(
        {
          count: 0,
          total: 0,
          perPage: 1,
          currentPage: 1,
          data: [],
        },
        STATUS_MESSAGES.NO_DATA,
      );
    }

    filter._id = { $in: enrolledCourseIds };
  }

  const count = await Course.countDocuments(filter);

  if (count === 0) {
    return res.out(
      {
        count: 0,
        total: 0,
        perPage: 1,
        currentPage: 1,
        data: [],
      },
      STATUS_MESSAGES.NO_DATA,
    );
  }

  const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
  const currentPage = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
  const skip = (currentPage - 1) * limit > 0 ? (currentPage - 1) * limit : 0;
  const sort = (req.query.sort as any) || -1;

  const courses = await Course.find<ICourseResponse>(filter).sort({ createdAt: sort }).limit(limit).skip(skip).populate('instructor', 'name pictureId pictureUrl profession description');

  const enrichedCourses: ICourseResponse[] = [];

  if (req.isAuthenticated()) {
    const userId = req.user._id;
    const coursesIds = courses.map((c) => c._id);
    const enrollments = await Enrollment.find(
      { userId: userId, courseId: { $in: coursesIds } },
      { _id: 1, courseId: 1 },
    );

    const userProgresses = await UserProgress.find({ userId, courseId: { $in: coursesIds } });

    for (const course of courses) {
      const enrolled = !!enrollments.find((e) => e.courseId.toString() === course.id);

      const userProgress = userProgresses.find((p) => p.courseId.toString() === course.id);

      // Get all lectures sorted in order
      const chapters = await Chapter.find({ courseId: course._id }).sort({ order: 1 });

      const allLectures = chapters.flatMap((chapter) => chapter.lectures);

      const total = allLectures.length;
      const completed = userProgress ? userProgress.lectures.length : 0;

      let currentLectureId = null;

      if (allLectures.length) {
        if (userProgress?.lectures.length) {
          const lastCompletedLecture = userProgress.lectures[userProgress.lectures.length - 1];
          const lastIndex = allLectures.findIndex((lec) => lec._id.toString() === lastCompletedLecture);

          if (lastIndex !== -1 && lastIndex + 1 < allLectures.length) {
            currentLectureId = allLectures[lastIndex + 1]._id; // Next lecture
          } else {
            currentLectureId = allLectures[allLectures.length - 1]._id; // Last lecture
          }
        } else {
          currentLectureId = allLectures[0]._id; // First lecture if no progress
        }
      }

      const progress = total ? (completed / total) * 100 : 0;

      enrichedCourses.push({
        ...(course as any)._doc,
        thumbnail:
          course.thumbnail && course.thumbnail.includes(MEDIA_BASE_URL)
            ? course.thumbnail
            : `${MEDIA_BASE_URL}/${course.thumbnail}`,
        id: course._id.toString(),
        enrolled,
        progress,
        currentLectureId,
        instructor: course.instructor,
      });
    }
  }

  const out = {
    total: count,
    count: req.isAuthenticated() ? enrichedCourses.length : courses.length,
    perPage: limit,
    currentPage,
    data: req.isAuthenticated()
      ? enrichedCourses
      : courses.map((c) => ({
        ...(c as any)._doc,
        thumbnail:
          c.thumbnail && c.thumbnail.includes(MEDIA_BASE_URL) ? c.thumbnail : `${MEDIA_BASE_URL}/${c.thumbnail}`,
        id: c._id.toString(),
        enrolled: false,
        progress: 0,
        currentLectureId: null,
        instructor: c.instructor,
      })),
  };

  return res.out<IDataLoadedResponse<ICourseResponse>>(out);
});


export const list = asyncHandler(async (req: Request, res: Response) => {
  if (req.query.enrolled == 'true' && !req.isAuthenticated()) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  // Only return courses that have a playbackUrl in videoStatus (non-empty)
  // AND only published courses (user-facing).
  let filter: any = {
    'videoStatus.playbackUrl': { $exists: true, $nin: ['', null] },
    published: true,
  };

  if (req.query.enrolled === 'true') {
    const enrolledCourses = await Enrollment.find({ userId: req.user._id }).select('courseId');
    const enrolledCourseIds = enrolledCourses.map((e) => e.courseId);

    if (enrolledCourseIds.length === 0) {
      return res.out(
        {
          count: 0,
          total: 0,
          perPage: 1,
          currentPage: 1,
          data: [],
        },
        STATUS_MESSAGES.NO_DATA,
      );
    }

    filter._id = { $in: enrolledCourseIds };
  }

  const count = await Course.countDocuments(filter);

  if (count === 0) {
    return res.out(
      {
        count: 0,
        total: 0,
        perPage: 1,
        currentPage: 1,
        data: [],
      },
      STATUS_MESSAGES.NO_DATA,
    );
  }

  const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
  const currentPage = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
  const skip = (currentPage - 1) * limit > 0 ? (currentPage - 1) * limit : 0;
  const sort = (req.query.sort as any) || -1;

  const courses = await Course.find<ICourseResponse>(filter).sort({ createdAt: sort }).limit(limit).skip(skip).populate('instructor', 'name pictureId pictureUrl profession description');

  // Prepare reactions map and userReaction map for the batch of courses
  const coursesIds = courses.map((c) => c._id);

  const reactionsAgg = await Reaction.aggregate([
    { $match: { course: { $in: coursesIds } } },
    { $group: { _id: { course: '$course', type: '$type' }, count: { $sum: 1 } } },
  ]);

  const reactionsMap = new Map<string, { like: number; love: number; wow: number; total: number }>();
  reactionsAgg.forEach((r: any) => {
    const courseId = r._id.course.toString();
    const type = r._id.type as string;
    if (!reactionsMap.has(courseId)) reactionsMap.set(courseId, { like: 0, love: 0, wow: 0, total: 0 });
    const obj = reactionsMap.get(courseId)!;
    if (type === 'like' || type === 'love' || type === 'wow') {
      obj[type] = r.count;
      obj.total += r.count;
    }
  });

  const userReactionMap = new Map<string, string>();
  if (req.isAuthenticated()) {
    const userId = req.user._id;
    const userReactions = await Reaction.find({ user: userId, course: { $in: coursesIds } }).select('course type').lean();
    userReactions.forEach((ur: any) => userReactionMap.set(ur.course.toString(), ur.type));
  }

  const enrichedCourses: ICourseResponse[] = [];

  if (req.isAuthenticated()) {
    const userId = req.user._id;
    const coursesIdsLocal = courses.map((c) => c._id);
    const enrollments = await Enrollment.find(
      { userId: userId, courseId: { $in: coursesIdsLocal } },
      { _id: 1, courseId: 1 },
    );

    const userProgresses = await UserProgress.find({ userId, courseId: { $in: coursesIdsLocal } });

    for (const course of courses) {
      const enrolled = !!enrollments.find((e) => e.courseId.toString() === course.id);

      const userProgress = userProgresses.find((p) => p.courseId.toString() === course.id);

      // Get all lectures sorted in order
      const chapters = await Chapter.find({ courseId: course._id }).sort({ order: 1 });

      const allLectures = chapters.flatMap((chapter) => chapter.lectures);

      const total = allLectures.length;
      const completed = userProgress ? userProgress.lectures.length : 0;

      let currentLectureId = null;

      if (allLectures.length) {
        if (userProgress?.lectures.length) {
          const lastCompletedLecture = userProgress.lectures[userProgress.lectures.length - 1];
          const lastIndex = allLectures.findIndex((lec) => lec._id.toString() === lastCompletedLecture);

          if (lastIndex !== -1 && lastIndex + 1 < allLectures.length) {
            currentLectureId = allLectures[lastIndex + 1]._id; // Next lecture
          } else {
            currentLectureId = allLectures[allLectures.length - 1]._id; // Last lecture
          }
        } else {
          currentLectureId = allLectures[0]._id; // First lecture if no progress
        }
      }

      const progress = total ? (completed / total) * 100 : 0;

      enrichedCourses.push({
        ...(course as any)._doc,
        thumbnail:
          course.thumbnail && course.thumbnail.includes(MEDIA_BASE_URL)
            ? course.thumbnail
            : `${MEDIA_BASE_URL}/${course.thumbnail}`,
        id: course._id.toString(),
        enrolled,
        progress,
        currentLectureId,
        instructor: course.instructor,
        reactions: reactionsMap.get(course._id.toString()) || { like: 0, love: 0, wow: 0, total: 0 }, // added
        userReaction: userReactionMap.has(course._id.toString()) ? { type: userReactionMap.get(course._id.toString()) } : {}, // added
      });
    }
  }

  const out = {
    total: count,
    count: req.isAuthenticated() ? enrichedCourses.length : courses.length,
    perPage: limit,
    currentPage,
    data: req.isAuthenticated()
      ? enrichedCourses
      : courses.map((c) => ({
        ...(c as any)._doc,
        thumbnail:
          c.thumbnail && c.thumbnail.includes(MEDIA_BASE_URL) ? c.thumbnail : `${MEDIA_BASE_URL}/${c.thumbnail}`,
        id: c._id.toString(),
        enrolled: false,
        progress: 0,
        currentLectureId: null,
        instructor: c.instructor,
        reactions: reactionsMap.get(c._id.toString()) || { like: 0, love: 0, wow: 0, total: 0 }, // added
        userReaction: {}, // added (not authenticated)
      })),
  };

  return res.out<IDataLoadedResponse<ICourseResponse>>(out);
});


export const enroll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  const course = await Course.findOne({ slug: req.params.id }); // <-- updated
  if (!course) {
    throw new AppError('Course not found', STATUS_MESSAGES.NOT_FOUND);
  }

  await course.enroll(req.user._id as ObjectId);

  return res.out({ message: 'Enrolled' });
});


export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  const course = await Course.findOne({ slug: req.params.id }); // or req.params.slug
  if (!course) {
    throw new AppError('Course not found', STATUS_MESSAGES.NOT_FOUND);
  }

  const userProgress = await UserProgress.findOne({
    courseId: course._id,
    userId: req.user._id,
  });

  return res.out({ userProgress });
});


/**
 * POST /courses/reaction_course
 * Body: { courseId: string, type: 'like'|'love'|'wow' }
 *
 * Behavior:
 * - If user had NO prior reaction -> create reaction and atomically increment Course.display.likes by 1
 * - If user had prior reaction:
 *    - same type -> no-op (returns current total)
 *    - different type -> update reaction type, likes unchanged
 *
 * Response: res.out({ data: { type: string|null, total: number, reaction?: object }, message })
 */
export const reactToCourse = asyncHandler(async (req: Request, res: Response) => {
  const { courseId, type } = req.body as { courseId?: string; type?: string };
  const userId = req.user?._id;

  if (!courseId || !isValidObjectId(courseId)) {
    throw new AppError('Invalid courseId', STATUS_MESSAGES.UNEXPECTED_ERROR);
  }

  if (!userId) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  if (!type || !['like', 'love', 'wow'].includes(type)) {
    throw new AppError('Invalid reaction type', STATUS_MESSAGES.INVALID_URL_PARAMETER);
  }

  // Ensure course exists
  const courseDoc = await Course.findById(courseId).select('display.likes').exec();
  if (!courseDoc) {
    throw new AppError('Course not found', STATUS_MESSAGES.NOT_FOUND);
  }

  // Find existing reaction for this user+course
  const existing = await Reaction.findOne({ user: userId, course: courseId }).lean();

  // If no existing reaction -> create one and increment likes
  if (!existing) {
    const created = await Reaction.create({ user: userId, course: courseId, type });

    // Use atomic increment on Course model (preferred).
    // If the model exposes an instance method incrementLikes, call it; otherwise use $inc.
    let newTotal = 0;
    try {
      if (typeof (courseDoc as any).incrementLikes === 'function') {
        newTotal = await (courseDoc as any).incrementLikes(1);
      } else {
        // fallback - atomic increment via updateOne
        const updated = await Course.findByIdAndUpdate(courseId, { $inc: { 'display.likes': 1 } }, { new: true, select: 'display.likes' }).lean();
        newTotal = (updated?.display?.likes ?? 0) as number;
      }
    } catch (err) {
      console.error('[reactToCourse] failed incrementing likes', err);
      // best-effort: read current value
      const fresh = await Course.findById(courseId).select('display.likes').lean();
      newTotal = (fresh?.display?.likes ?? 0) as number;
    }

    return res.out({
      data: { type: created.type, total: newTotal, reaction: created },
      message: 'Reaction saved',
    });
  }

  // If existing reaction exists and type is the same -> nothing to change
  if (existing.type === type) {
    // read current likes count
    const fresh = await Course.findById(courseId).select('display.likes').lean();
    const total = (fresh?.display?.likes ?? 0) as number;
    return res.out({
      data: { type: existing.type, total },
      message: 'Reaction unchanged',
    });
  }

  // Existing reaction exists and type is different -> update reaction type only, likes unchanged
  const updatedReaction = await Reaction.findOneAndUpdate(
    { user: userId, course: courseId },
    { $set: { type } },
    { new: true }
  ).lean();

  const freshCourse = await Course.findById(courseId).select('display.likes').lean();
  const totalAfter = (freshCourse?.display?.likes ?? 0) as number;

  return res.out({
    data: { type: updatedReaction?.type ?? type, total: totalAfter, reaction: updatedReaction },
    message: 'Reaction updated',
  });
});


/**
 * DELETE /courses/reaction_delete
 * Accepts either:
 *  - DELETE /courses/reaction_delete/:id  (param id)
 *  - DELETE /courses/reaction_delete  with body { courseId: string }
 *
 * Behavior:
 *  - Deletes the user's reaction (scoped to user)
 *  - If deleted, atomically decrement Course.display.likes by 1 (clamped to 0)
 *
 * Response: res.out({ message, data: { deleted, total } })
 */
export const deleteReaction = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('Unauthenticated', STATUS_MESSAGES.UNAUTHENTICATED);
  }

  const idFromParam = req.params?.id;
  const courseIdFromBody = req.body?.courseId;

  const baseFilter: any = { user: userId };
  let filter: any = { ...baseFilter };

  if (idFromParam) {
    if (!isValidObjectId(idFromParam)) {
      return res.out({ message: 'No reaction to remove' }, STATUS_MESSAGES.NO_DATA);
    }
    filter._id = idFromParam;
  } else if (courseIdFromBody) {
    if (!isValidObjectId(courseIdFromBody)) {
      return res.out({ message: 'No reaction to remove' }, STATUS_MESSAGES.NO_DATA);
    }
    filter.course = courseIdFromBody;
  } else {
    return res.out({ message: 'No reaction to remove' }, STATUS_MESSAGES.NO_DATA);
  }

  // Atomic read+delete
  const deleted = await Reaction.findOneAndDelete(filter).lean();

  if (!deleted) {
    return res.out({ message: 'No reaction to remove' }, STATUS_MESSAGES.NO_DATA);
  }

  // If a reaction was deleted, decrement likes atomically
  try {
    const theCourseId = deleted.course ?? courseIdFromBody;
    if (theCourseId && isValidObjectId(String(theCourseId))) {
      // Attempt using model instance method if available
      const courseDoc = await Course.findById(String(theCourseId)).exec();
      let after = 0;

      if (courseDoc && typeof (courseDoc as any).decrementLikes === 'function') {
        after = await (courseDoc as any).decrementLikes(1);
      } else {
        // fallback atomic decrement with clamp-to-zero
        const updated = await Course.findByIdAndUpdate(
          String(theCourseId),
          { $inc: { 'display.likes': -1 } },
          { new: true, select: 'display.likes' }
        ).lean();

        after = (updated?.display?.likes ?? 0) as number;

        if (after < 0) {
          await Course.updateOne({ _id: theCourseId }, { $set: { 'display.likes': 0 } });
          after = 0;
        }
      }

      return res.out({ message: 'Reaction removed', data: { deleted, total: after } });
    }
  } catch (err) {
    console.error('[deleteReaction] failed to decrement display.likes', err);
    // fall through to return deleted
  }

  // If we couldn't update likes, still return deleted reaction
  return res.out({ message: 'Reaction removed', data: { deleted, total: undefined } });
});