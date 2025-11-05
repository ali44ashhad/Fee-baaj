import { mainController } from '@/lib/mainController';
import { asyncHandler } from '@elearning/lib';
import { Category, Course, Enrollment, Review, User } from '@elearning/models';
import { IDashboardStatsResponse } from '@elearning/types';
import { Request, Response } from 'express';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const courses = await Course.countDocuments({ published: true });
  const enrollments = await Enrollment.countDocuments();
  const reviews = await Review.countDocuments({ approved: true });
  const students = await User.countDocuments({ active: true });

  return res.out<IDashboardStatsResponse>({ courses, enrollments, reviews, students });
});
