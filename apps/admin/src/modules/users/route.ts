import express from 'express';
import { validate } from '@elearning/lib';
import { create, list, read, remove, update } from './controller';
import { UserSaveSchema } from '@elearning/schemas';

const router = express.Router();

// Now: expect JSON body; no multer or file uploads handled by Admin API.
// The media server handles image uploads and will send back pictureId/pictureUrl to be stored in the user record.

router.post('/', validate(UserSaveSchema), create);
router.put('/:id', validate(UserSaveSchema), update);
router.get('/', list);
router.get('/:id', read);
router.delete('/:id', remove);

export default router;
