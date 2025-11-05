import express from 'express';
import { getInstructorById } from './controller'; // adjust the path if needed

const router = express.Router();

router.get('/:id', getInstructorById);

export default router;
