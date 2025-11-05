import express from 'express';
import { getReports } from './controller';

const router = express.Router();

// GET /api/reports?page=1&limit=10&resolved=true
router.get('/messages', getReports);

export default router;