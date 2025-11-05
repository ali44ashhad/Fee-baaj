import { fetcher as fetch } from '../../lib/fetcher';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { mainController } from '@/lib/mainController';
import { AppError, asyncHandler } from '@elearning/lib';
import { Chapter } from '@elearning/models';
import { ILectureDeleteResponse, ILectureSaveResponse,ILectureVideoPopup, STATUS_MESSAGES,  } from '@elearning/types';
import {
  uploadVideoProcess,

  deleteVideoFromBunny,
} from '../../helper/uploadService';

import fs from 'fs/promises';

export const create = asyncHandler(async (req: Request, res: Response) => {
  mainController.create(req, res, Chapter);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  mainController.update(req, res, Chapter);
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  mainController.read(req, res, Chapter);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  mainController.list(req, res, Chapter);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  mainController.remove(req, res, Chapter);
});

export const addLecture = asyncHandler(async (req: Request, res: Response) => {
  const chapter = await Chapter.findById(req.params.id);

  if (!chapter) {
    throw new AppError('chapter not found.', STATUS_MESSAGES.NOT_FOUND);
  }

  chapter.lectures.push(req.body);

  await chapter.save();

  const savedLecture = chapter.lectures[chapter.lectures.length - 1];

  return res.out<ILectureSaveResponse>({ message: 'Added.', lecture: savedLecture }, STATUS_MESSAGES.CREATED);
});



export const updateLecture = asyncHandler(async (req: Request, res: Response) => {
  const { id: chapterId, lectureId } = req.params;

  const chapter = await Chapter.findById(chapterId);
  if (!chapter) throw new AppError('Chapter not found.', STATUS_MESSAGES.NOT_FOUND);

  const idx = chapter.lectures.findIndex((l) => l._id.toString() === lectureId);
  if (idx === -1) throw new AppError('Lecture not found.', STATUS_MESSAGES.NOT_FOUND);

  const lecture = chapter.lectures[idx];

  const { title, videoPopups, duration } = req.body as {
    title?: string;
    videoPopups?: ILectureVideoPopup[];
    duration: number;
  };

  const parsedPopups = videoPopups ?? lecture.videoPopups ?? [];

  // ✅ Make sure to safely cast Multer files
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoFile = files?.video?.[0];

  let newVideoId = lecture.video;

  if (videoFile) {
    try {
      newVideoId = await uploadVideoProcess(videoFile.path, title || lecture.title);

      if (lecture.video) {
        await deleteVideoFromBunny(lecture.video);
      }
    } finally {
      // ✅ Always clean up temp file (important in production)
      await fs.unlink(videoFile.path).catch(() => null);
    }
  }

  lecture.title = title ?? lecture.title;
  lecture.video = newVideoId;
  lecture.duration = duration;
  lecture.videoPopups = parsedPopups;

  await chapter.save();

  return res.out<ILectureSaveResponse>(
    { message: 'Lecture updated.', lecture },
    STATUS_MESSAGES.UPDATED
  );
});



export const removeLecture = asyncHandler(async (req: Request, res: Response) => {
  // expects: req.params.id => chapterId, req.params.lectureId => lectureId
  const chapterId = req.params.id;
  const lectureId = req.params.lectureId;

  if (!chapterId || !lectureId) {
    return res.status(400).json({ success: false, message: 'chapter id and lecture id required' });
  }

  // load chapter so we can get courseId (needed to instruct media server)
  const chapter = await Chapter.findById(chapterId);
  if (!chapter) {
    return res.status(404).json({ success: false, message: 'Chapter not found' });
  }

  // find lecture and optionally its video key/id for logging
  const lecture = (chapter.lectures || []).find((l: any) => String(l._id) === String(lectureId) || String(l.id) === String(lectureId));
  if (!lecture) {
    return res.status(404).json({ success: false, message: 'Lecture not found in chapter' });
  }

  // 1) Ask media-server to delete lecture media
  try {
    const mediaUrlBase = process.env.MEDIA_API_URL || process.env.MEDIA_SERVER_URL || '';
    if (mediaUrlBase) {
      const mediaDeleteUrl = `${mediaUrlBase.replace(/\/$/, '')}/api/media/delete`;
      const authHeader = `Bearer ${process.env.ADMIN_API_KEY || ''}`;
      const body = { type: 'lecture', courseId: String(chapter.courseId), lectureId: String(lecture._id) };

      try {
        const resp = await fetch(mediaDeleteUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => ({}));
        console.log('[chapter.removeLecture] media-delete response', { status: resp.status, body: json });
      } catch (err) {
        console.warn('[chapter.removeLecture] media-delete request failed (non-fatal):', (err as any)?.message || err);
      }
    } else {
      console.warn('[chapter.removeLecture] MEDIA_API_URL not configured — skipping media-delete call');
    }
  } catch (e) {
    console.warn('[chapter.removeLecture] media-delete flow error (non-fatal):', (e as any)?.message || e);
  }

  // 2) Remove lecture from chapter document (atomic update)
  try {
    const result = await Chapter.findByIdAndUpdate(
      chapterId,
      { $pull: { lectures: { _id: new mongoose.Types.ObjectId(lectureId) } } },
      { new: true }
    ).lean();

    if (!result) {
      return res.status(404).json({ success: false, message: 'Failed removing lecture' });
    }

    // return the updated chapter (or simple success message)
    return res.json({ success: true, message: 'Lecture deleted', chapter: result });
  } catch (err: any) {
    console.error('[chapter.removeLecture] DB error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});