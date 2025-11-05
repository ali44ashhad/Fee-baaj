// /routes/images.ts
import express from 'express';
import axios from 'axios';
import { AppError } from '@elearning/lib';
import {STATUS_MESSAGES } from '@elearning/types';

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  const imageId = req.params.id;

  try {
    const imageUrl = `https://ThumNailfreebajPull.b-cdn.net/${imageId}`;

    const response = await axios.get(imageUrl, { responseType: 'stream' });

    res.set('Content-Type', response.headers['content-type']);
    response.data.pipe(res);
  } catch (err) {
    next(new AppError('Image not found', STATUS_MESSAGES.NOT_FOUND));
  }
});

export default router;
