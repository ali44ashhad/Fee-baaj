import config from '@/config';
import { asyncHandler, MEDIA_BASE_URL } from '@elearning/lib';
import { Request, Response } from 'express';

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const path = req.file.path.split('\\').join('/').replace(config.media.base_dir, '');
  res.out({
    path: path,
    url: `${MEDIA_BASE_URL}${path}`,
  });
});
