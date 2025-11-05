import { mainController } from '@/lib/mainController';
import { asyncHandler } from '@elearning/lib';
import { Setting } from '@elearning/models';
import { Request, Response } from 'express';

export const update = asyncHandler(async (req: Request, res: Response) => {
  req.params.id = "67ccc9222bbc2e6cdb51e944";
  mainController.update(req, res, Setting);
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  req.params.id = "67ccc9222bbc2e6cdb51e944";
  mainController.read(req, res, Setting);
});
