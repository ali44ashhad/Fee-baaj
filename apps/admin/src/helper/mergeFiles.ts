// mergeFiles.ts
import { Request, Response, NextFunction } from 'express';

export function mergeFiles(req: Request, res: Response, next: NextFunction) {
    console.log('Merged files into body:', req.body);
  // If files exist in req.files, merge them into req.body.
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files.video && files.video.length > 0) {
      // Put the first video file on req.body.video
      req.body.video = files.video[0];
    }
    if (files.thumbnail && files.thumbnail.length > 0) {
      req.body.thumbnail = files.thumbnail[0];
    }
  }
  next();
}
