import express from 'express';
import { checkAuth, login, logout } from './controller';

const router = express.Router();

router.post('/login', login);
router.get('/check', checkAuth);
router.post('/logout', logout);

export default router;