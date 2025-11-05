import express from 'express';
import { read, unlock } from './controller';

const router = express.Router();

router.get('/:id', read);
router.post('/:id/unlock', unlock);

export default router;
