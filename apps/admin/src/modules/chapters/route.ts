import { validate } from '@elearning/lib';
import { LectureSaveSchema, ChapterSaveSchema, ChapterUpdateSchema } from '@elearning/schemas';
import multer from 'multer';
import express from 'express';
import {
  create,
  update,
  read,
  list /* addLecture, updateLecture, removeLecture, remove */,
  addLecture,
  updateLecture,
  removeLecture,
  remove,
} from './controller';

const router = express.Router();

// Set up multer storage (temporary disk storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Temporary folder for uploads
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1000 }, // e.g. 10GB max
});

const uploadFields = upload.fields([
  { name: 'video', maxCount: 1 },
]);


router.post('/', validate(ChapterSaveSchema), create);
router.put('/:id', validate(ChapterUpdateSchema), update);

router.get('/', list);
router.get('/:id', read);

router.delete('/:id', remove);

//router.delete('/:id', remove);

router.post('/:id/lectures',uploadFields,  validate(LectureSaveSchema), addLecture);
router.put('/:id/lectures/:lectureId',uploadFields,  validate(LectureSaveSchema), updateLecture);
router.delete('/:id/lectures/:lectureId', removeLecture);

export default router;
