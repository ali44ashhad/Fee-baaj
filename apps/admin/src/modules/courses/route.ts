import { validate } from '@elearning/lib';
import { CourseSaveSchema } from '@elearning/schemas';
import multer from 'multer';
import express from 'express';
import { create, update, read, list, remove } from './controller';

const router = express.Router();

// // Set up multer storage (temporary disk storage)
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Temporary folder for uploads
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 * 1000 }, // e.g. 10GB max
// });

// // Define allowed fields for upload
// const uploadFields = upload.fields([
//   { name: 'video', maxCount: 1 },
//   { name: 'thumbnail', maxCount: 1 },
// ]);

// Route handling file upload and passing data to the controller
router.post('/', validate(CourseSaveSchema), create); // metadata-only
router.put('/:id', validate(CourseSaveSchema), update); // metadata only

router.get('/', list);
router.get('/:id', read);

router.delete('/:id', remove);

export default router;


