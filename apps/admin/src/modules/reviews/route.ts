import express from 'express';
import { validate } from '@elearning/lib';
import { create, list, read, remove, update } from './controller';
import { ReviewSaveSchema } from '@elearning/schemas';

const router = express.Router();

router.post('/', validate(ReviewSaveSchema), create);

router.put('/:id', validate(ReviewSaveSchema), update);

router.get('/', list);

router.get('/:id', read);

router.delete('/:id', remove);

export default router;
