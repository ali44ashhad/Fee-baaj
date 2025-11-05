// src/routes/mediaHooks.ts
import { Router } from 'express';
import { postMediaStatus } from './controller';

const router = Router();

// mount at /api/media/hooks/status
router.post('/hooks/status', postMediaStatus);

export default router;
