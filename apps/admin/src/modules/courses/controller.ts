import { fetcher as fetch } from '../../lib/fetcher';
import { Request, Response } from 'express';
import { mainController } from '@/lib/mainController';
import { asyncHandler } from '@elearning/lib';
import { Chapter, Course } from '@elearning/models';
import { STATUS_MESSAGES } from '@/../../../packages/types/src';
import generateUniqueSlug from '../../helper/generateUniqueSlug';
import fs from 'fs/promises';
import path from 'path';

import {
  uploadVideoProcess,
  uploadImageToBunny,
  getBunnyVideoLength,
  deleteVideoFromBunny,
  deleteImageFromBunny,
  getBunnyPreviewUrl
} from '../../helper/uploadService';
import { createImageEntry } from '../../helper/createImageEntry';

type CoursePayload = {
  title: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  categoryId: string;
  instructorId: string;
  objectives: string[];
  requirements: string[];
  bestSeller: boolean;
  premium: boolean;
  published: boolean;
  videoPopups: any[];
  display: any;
  thumbnailUrl?: string;
  thumbnailId?: string;
  bunnyVideoId?: string;
};

const parseCoursePayload = async (
  req: Request,
  isUpdate = false
): Promise<{ payload: CoursePayload; videoFile?: Express.Multer.File; thumbnailFile?: Express.Multer.File }> => {
  const {
    title,
    slug,
    subtitle,
    description,
    price,
    originalPrice,
    categoryId,
    instructorId,
    objectives,
    requirements,
    bestSeller,
    premium,
    published,
    videoPopups,
    display,
  } = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoFile = files?.video?.[0];
  const thumbnailFile = files?.thumbnail?.[0];

  if (
    title == null ||
    price == null ||
    instructorId == null ||
    categoryId == null ||
    display == null
  ) {
    throw new Error('Missing required fields.');
  }

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice) || numericPrice < 0) {
    throw new Error('Invalid price value.');
  }

  const parsedObjectives = Array.isArray(objectives) ? objectives : [objectives];
  const parsedRequirements = Array.isArray(requirements) ? requirements : [requirements];

  let parsedDisplay: any;
  try {
    parsedDisplay = typeof display === 'string' ? JSON.parse(display) : display;
  } catch {
    throw new Error('Invalid display object.');
  }

  let parsedVideoPopups: any[] = [];
  try {
    parsedVideoPopups = typeof videoPopups === 'string' ? JSON.parse(videoPopups) : videoPopups;
    if (!Array.isArray(parsedVideoPopups)) parsedVideoPopups = [parsedVideoPopups];
  } catch {
    parsedVideoPopups = [];
  }

  const payload: CoursePayload = {
    title,
    slug,               // <-- allow optional slug override
    subtitle,
    description,
    price: numericPrice,
    originalPrice,
    categoryId,
    instructorId,
    objectives: parsedObjectives,
    requirements: parsedRequirements,
    bestSeller: bestSeller === 'true' || bestSeller === true,
    premium: premium === 'true' || premium === true,
    published: published === 'true' || published === true,
    videoPopups: parsedVideoPopups,
    display: parsedDisplay,
  };

  return { payload, videoFile, thumbnailFile };
};

const mapLecturesWithPreview = async (lectures: any[]) => {
  return Promise.all(
    lectures.map(async (lec) => {
      const lecture = { ...lec };
      if (typeof lec.video === 'string' && lec.video.trim() !== '') {
        try {
          lecture.previewUrl = await getBunnyPreviewUrl(lec.video);
        } catch (err) {
          console.error(`Failed to fetch Bunny preview for ${lec.video}:`, err);
        }
      }
      return lecture;
    })
  );
};

const handleFileUploads = async (
  videoFile?: Express.Multer.File,
  thumbnailFile?: Express.Multer.File,
  title?: string
) => {
  let videoId = '';
  let thumbnailUrl = '';

  if (videoFile && title) {
    videoId = await uploadVideoProcess(videoFile.path, title);
  }

  if (thumbnailFile) {
    const imageId = await createImageEntry(path.basename(thumbnailFile.path));
    const uploadSuccess = await uploadImageToBunny(thumbnailFile.path, imageId);
    if (!uploadSuccess) throw new Error('Thumbnail upload failed.');
    thumbnailUrl = `https://ThumNailfreebajPull.b-cdn.net/${imageId}`;
  }

  return { videoId, thumbnailUrl };
};

// CREATE COURSE
export const create = asyncHandler(async (req: Request, res: Response) => {
  let videoFile: Express.Multer.File | undefined;
  let thumbnailFile: Express.Multer.File | undefined;

  try {
    const { payload, videoFile: vFile, thumbnailFile: tFile } = await parseCoursePayload(req);
    videoFile = vFile;
    thumbnailFile = tFile;

    const { videoId, thumbnailUrl } = await handleFileUploads(videoFile, thumbnailFile, payload.title);
    if (videoId) payload.bunnyVideoId = videoId;
    if (thumbnailUrl) {
      payload.thumbnailUrl = thumbnailUrl;
      payload.thumbnailId = thumbnailUrl.split('/').pop()!;
    }

    // generate slug from title
    payload.slug = await generateUniqueSlug(payload.title);

    const course = await Course.create(payload);
    return res.status(201).json({ success: true, message: 'Created', _id: course._id });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  } finally {
    if (videoFile) await fs.unlink(videoFile.path).catch(() => null);
    if (thumbnailFile) await fs.unlink(thumbnailFile.path).catch(() => null);
  }
});

// UPDATE COURSE
export const update = asyncHandler(async (req: Request, res: Response) => {
  let videoFile: Express.Multer.File | undefined;
  let thumbnailFile: Express.Multer.File | undefined;

  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const oldVideoId = course.bunnyVideoId;
    const oldThumbnailUrl = course.thumbnailUrl;

    const { payload, videoFile: vFile, thumbnailFile: tFile } = await parseCoursePayload(req, true);
    videoFile = vFile;
    thumbnailFile = tFile;

    const { videoId, thumbnailUrl } = await handleFileUploads(videoFile, thumbnailFile, payload.title);
    if (videoId) {
      if (oldVideoId) await deleteVideoFromBunny(oldVideoId).catch(console.error);
      payload.bunnyVideoId = videoId;
    }
    if (thumbnailUrl) {
      const oldImageName = typeof oldThumbnailUrl === 'string'
        ? oldThumbnailUrl.split('/').pop()
        : null;
      if (oldImageName) await deleteImageFromBunny(oldImageName).catch(console.error);
      payload.thumbnailUrl = thumbnailUrl;
      payload.thumbnailId = thumbnailUrl.split('/').pop()!;
    }

    // slug override: if admin provided one, generate & ensure uniqueness;
    // otherwise keep existing slug
    if (payload.slug && payload.slug.trim() !== '') {
   
      payload.slug = await generateUniqueSlug(payload.slug, course._id.toString());
    } else {
    
      payload.slug = course.slug!;
    }

    Object.assign(course, payload);
    await course.save();

    return res.status(200).json({ success: true, message: 'Updated', _id: course._id });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  } finally {
    if (videoFile) await fs.unlink(videoFile.path).catch(() => null);
    if (thumbnailFile) await fs.unlink(thumbnailFile.path).catch(() => null);
  }
});



// GET SINGLE COURSE + CHAPTERS + VIDEO LENGTH
export const read = asyncHandler(async (req: Request, res: Response) => {
  mainController.read(req, res, Course, async (course) => {
    const chapters = await Chapter.find({ courseId: course._id }).lean();

    const chaptersWithLectures = await Promise.all(
      chapters.map(async (chapter) => ({
        ...chapter,
        lectures: await mapLecturesWithPreview(chapter.lectures || []),
      }))
    );

    let videoLength = null;
    if (course.bunnyVideoId) {
      try {
        videoLength = await getBunnyVideoLength(course.bunnyVideoId);
      } catch (error) {
        console.error("Error fetching video length:", error);
      }
    }

    return res.out({
      ...(course as any).toObject(),
      chapters: chaptersWithLectures,
      videoLength,
    });
  });
});

// ADMIN: LIST COURSES with optional published filter + search + pagination
export const list = asyncHandler(async (req: Request, res: Response) => {
  // parse query params
  const page = req.query.page && typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
  const limit = req.query.limit && typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
  const sort = (req.query.sort as any) || -1;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const publishedRaw = typeof req.query.published === 'string' ? req.query.published : undefined;

  const filter: any = {};

  // search by title or slug if provided
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  // published filter: 'true' or 'false' (string)
  if (publishedRaw === 'true') filter.published = true;
  else if (publishedRaw === 'false') filter.published = false;
  // otherwise undefined => return both published & drafts

  const count = await Course.countDocuments(filter);

  if (count === 0) {
    return res.out(
      {
        count: 0,
        total: 0,
        perPage: limit,
        currentPage: page,
        data: [],
      },
      STATUS_MESSAGES.NO_DATA,
    );
  }

  const skip = page > 1 ? (page - 1) * limit : 0;

  const courses = await Course.find(filter)
    .sort({ createdAt: sort })
    .limit(limit)
    .skip(skip)
    .populate('instructor', 'name pictureId pictureUrl profession description')
    .lean();

  // you'll likely want to return raw course objects for admin (no extra enrichment)
  const out = {
    total: count,
    count: courses.length,
    perPage: limit,
    currentPage: page,
    data: courses,
  };

  return res.out(out);
});

// DELETE COURSE
// in your admin controllers file (e.g. controllers/course.ts) — replace/export remove
 // optional: if your node version doesn't have global fetch
// ...other imports remain the same

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  // 1) Ask media-server to delete course media (all lecture + intro)
  try {
    const mediaUrlBase = process.env.MEDIA_API_URL || process.env.MEDIA_SERVER_URL || '';
    if (mediaUrlBase) {
      const mediaDeleteUrl = `${mediaUrlBase.replace(/\/$/, '')}/api/media/delete`;
      const authHeader = `Bearer ${process.env.ADMIN_API_KEY || ''}`;
      const body = { type: 'course', courseId: String(course._id) };

      try {
        const resp = await fetch(mediaDeleteUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
        });

        const json = await resp.json().catch(() => ({}));
        console.log('[course.remove] media-delete response', { status: resp.status, body: json });
      } catch (err) {
        // non-fatal: log and continue (we still delete DB record)
        console.warn('[course.remove] media-delete request failed (non-fatal):', (err as any)?.message || err);
      }
    } else {
      console.warn('[course.remove] MEDIA_API_URL not configured — skipping media-delete call');
    }
  } catch (e) {
    console.warn('[course.remove] media-delete flow error (non-fatal):', (e as any)?.message || e);
  }



  // 3) delete DB record and respond
  await course.deleteOne();

  res.json({ message: 'Course and related assets deleted' });
});
