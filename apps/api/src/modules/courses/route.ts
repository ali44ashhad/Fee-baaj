import express from 'express';
import { read, list, enroll, getProgress, listPaid, reactToCourse, deleteReaction  } from './controller';

const router = express.Router();

router.get('/', list);

router.get("/paid", listPaid);

router.get('/:id', read);

router.post('/:id/enroll', enroll);

router.get('/:id/progress', getProgress);

router.post('/reaction_course', reactToCourse);

router.delete('/reaction_delete', deleteReaction); 

export default router;
