import { Request, Response } from 'express';
import { asyncHandler } from '@elearning/lib';
import { Chapter, Course, Enrollment, Instructor, Review, Setting, User } from '@elearning/models';
import { ISettingResponse } from '@elearning/types';

export const read = asyncHandler(async (req: Request, res: Response) => {
  const settings: ISettingResponse = await Setting.findOne();
  return res.out<ISettingResponse>(settings);
});
