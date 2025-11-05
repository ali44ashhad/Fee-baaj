import { Request, Response } from 'express';
import { AppError, asyncHandler } from '@elearning/lib';
import { Instructor } from '@elearning/models';
import { STATUS_MESSAGES } from '@elearning/types';
import { isValidObjectId } from 'mongoose';

export const getInstructorById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  

  if (!isValidObjectId(id)) {
    throw new AppError('Invalid instructor ID', STATUS_MESSAGES.NOT_FOUND);
  }

  const instructor = await Instructor.findById(id)

  if (!instructor) {
    throw new AppError('Instructor not found', STATUS_MESSAGES.NOT_FOUND);
  }

  return res.out(instructor);
});
