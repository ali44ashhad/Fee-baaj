import bcrypt from 'bcryptjs';
import { mainController } from '@/lib/mainController';
import { asyncHandler, PASSWORD_HASH_SALT } from '@elearning/lib';
import { User } from '@elearning/models';
import { Request, Response } from 'express';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.password) {
    req.body.password = await bcrypt.hash(req.body.password, PASSWORD_HASH_SALT);
  }
  mainController.create(req, res, User);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.password) {
    req.body.password = await bcrypt.hash(req.body.password, PASSWORD_HASH_SALT);
  }
  mainController.update(req, res, User);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  mainController.list(req, res, User);
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  mainController.read(req, res, User);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  mainController.remove(req, res, User);
});