import { mainController } from '@/lib/mainController';
import { asyncHandler } from '@elearning/lib';
import { Course, Review } from '@elearning/models';
import { Request, Response } from 'express';

export const create = asyncHandler(async (req: Request, res: Response) => {
  mainController.create(req, res, Review);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  mainController.update(req, res, Review);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  mainController.list(req, res, Review);
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  mainController.read(req, res, Review);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  mainController.remove(req, res, Review);
});
