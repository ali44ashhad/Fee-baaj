import express from 'express';
import { validate } from '@elearning/lib';
import { read, update } from './controller';
import { SettingSaveSchema } from '@elearning/schemas';

const router = express.Router();

router.put('/', validate(SettingSaveSchema), update);

router.get('/', read);

export default router;
