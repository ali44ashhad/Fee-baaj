import { Request, Response } from 'express';
import { asyncHandler } from '@elearning/lib';
import { Chapter, Course, Enrollment, Instructor, Review, User } from '@elearning/models';
import { ICourseResponse, IDataLoadedResponse, IReviewResponse, STATUS_MESSAGES } from '@elearning/types';

export const list = asyncHandler(async (req: Request, res: Response) => {
  req.query.limit = "5";
  const filter = { courseId: req.query.course_id, approved: true };
  const count = await Review.countDocuments(filter);

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

  const reviews = await Review.find<IReviewResponse>(filter).sort({ createdAt: sort }).limit(limit).skip(skip);

  const out = {
    total: count,
    count: reviews.length,
    perPage: limit,
    currentPage,
    data: reviews,
  };

  return res.out<IDataLoadedResponse<IReviewResponse>>(out);
});
