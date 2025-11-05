import express from 'express';
import { read } from './controller';

const router = express.Router();

router.get('/', read);

export default router;
