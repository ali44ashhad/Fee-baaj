// src/api/chat.routes.ts
import express from 'express';

import {
  getUserConversationsForInstructor,
  getInstructorMessages,
  postInstructorMessage,
  getInstructorMessagesAround,
  getMessageById,
  reportMessage,
} from './controller';

const router = express.Router();

router.get(
  '/instructor/:insId/messages/summary',

  getUserConversationsForInstructor
);

router.get(
  '/instructor/:insId/messages/:userId',

  getInstructorMessages
);

router.post(
  '/instructor/:insId/message/:userId',
  postInstructorMessage
);


router.get('/instructor/:insId/messages/around/:aroundId', getInstructorMessagesAround);

router.get('/message/:messageId', getMessageById);

router.get('/instructor/:insId/messages/:studenId/around', getInstructorMessagesAround); 
router.get('/instructor/:insId/messages/:studenId/around/:aroundId', getInstructorMessagesAround);

router.post('/message/:messageId/report', reportMessage);

export default router;