import express from 'express';
import { 
     getInstructorMessages, 
     postMessage, 
     getMessageSummaries, 
     getInstructorMessagesAround, 
     getMessageById, reportMessage 
    } from './controller';

const router = express.Router();

// GET history 
router.get('/instructor/:insId/messages', getInstructorMessages);

// POST a new message
router.post('/instructor/:insId/message', postMessage);


router.get('/instructor/messages/summary', getMessageSummaries);

router.get('/instructor/:insId/messages/around/:aroundId', getInstructorMessagesAround);

router.get('/message/:messageId', getMessageById);

router.get('/instructor/:insId/messages/around', getInstructorMessagesAround); 

router.post('/message/:messageId/report', reportMessage);



export default router;
 