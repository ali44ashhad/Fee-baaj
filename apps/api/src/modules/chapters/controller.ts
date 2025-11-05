import { Request, Response } from 'express';
import { asyncHandler } from '@elearning/lib';
import { Chapter, Course, Enrollment, Instructor, Review, User } from '@elearning/models';
import { IChapterResponse, IListAllResponse } from '@elearning/types';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const chapters: IChapterResponse[] = await Chapter.find({ courseId: req.query.course_id });

  const out = {
    count: chapters.length,
    data: chapters,
  };

  return res.out<IListAllResponse<IChapterResponse>>(out);
});
