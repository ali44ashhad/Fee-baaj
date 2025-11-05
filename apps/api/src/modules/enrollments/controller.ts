import { Request, Response } from 'express';
import { AppError, asyncHandler } from '@elearning/lib';
import { Chapter, Course, Enrollment, Referral, UserProgress } from '@elearning/models';
import { STATUS_MESSAGES } from '@elearning/types';
import { isValidObjectId } from 'mongoose';
import config from '@/config';

export const read = asyncHandler(async (req: Request, res: Response) => {
  const query = isValidObjectId(req.params.id)
    ? { _id: req.params.id, userId: req.user._id }
    : { referralCode: req.params.id };

  const enrollment = await Enrollment.findOne(query);

  if (!enrollment) {
    throw new AppError('Not found', STATUS_MESSAGES.NOT_FOUND);
  }

  const successfulReferrals = await Referral.countDocuments({
    code: enrollment.referralCode,
    success: true,
    enrollmentId: enrollment._id,
  });

  return res.out({
    ...enrollment.toObject(),
    referralData: {
      referralCount: successfulReferrals,
      requiredReferrals: 5,
      referralLink: `${config.web.url}/install/${enrollment.referralCode}`,
    },
  });
});

export const unlock = asyncHandler(async (req: Request, res: Response) => {
  const query = isValidObjectId(req.params.id)
    ? { _id: req.params.id, userId: req.user._id }
    : { referralCode: req.params.id };

  const enrollment = await Enrollment.findOne(query);

  console.log(enrollment, req.params.id);

  if (!enrollment) {
    throw new AppError('Not found', STATUS_MESSAGES.NOT_FOUND);
  }

  const successfulReferrals = await Referral.countDocuments({
    code: enrollment.referralCode,
    success: true,
    enrollmentId: enrollment._id,
  });

  if (successfulReferrals >= 5) {
    enrollment.unlocked = true;
    await enrollment.save();
  }

  return res.out({ message: 'Unlocked successfully' }, STATUS_MESSAGES.UPDATED);
});
