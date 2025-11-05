import config from '@/config';
import express from 'express';
import fs from 'fs';
import { upload } from './controller';

const router = express.Router();

// Simple MIME type to extension mapping
const mimeToExt = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dateObj = new Date();
    const day = dateObj.getUTCDate();
    const month = dateObj.getUTCMonth() + 1;
    const year = dateObj.getUTCFullYear();
    const fullPath = `${config.media.base_dir}/${year}/${month}/${day}/`;
    fs.mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: async function (req, file, cb) {
    const extension = mimeToExt[file.mimetype] || 'jpg';
    cb(null, Date.now() + '.' + extension);
  },
});

const uploadMiddleware = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(`${req.custom.local.unsupported_file_types} (jpeg, jpg, png)`);
  },
});

/**
 * POST /upload
 */
router.post('/', uploadMiddleware.single('picture'), upload);

export default router;
