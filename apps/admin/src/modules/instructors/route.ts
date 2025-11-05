import express from 'express';
import { validate } from '@elearning/lib';
import { create, list, read, remove, update } from './controller';
import { InstructorSaveSchema } from '@elearning/schemas';

const router = express.Router();

// Admin API now expects JSON payloads that may include pictureId/pictureUrl
router.post('/', validate(InstructorSaveSchema), create);
router.put('/:id', validate(InstructorSaveSchema), update);
router.get('/', list);
router.get('/:id', read);
router.delete('/:id', remove);

export default router;
