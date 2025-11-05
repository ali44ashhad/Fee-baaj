import express from 'express';
import { validate } from '@elearning/lib';
import { create, list, read, remove, update } from './controller';
import { CategorySaveSchema } from '@elearning/schemas';

const router = express.Router();

router.post('/', validate(CategorySaveSchema), create);

router.put('/:id', validate(CategorySaveSchema), update);

router.get('/', list);

router.get('/:id', read);

router.delete('/:id', remove);

export default router;
