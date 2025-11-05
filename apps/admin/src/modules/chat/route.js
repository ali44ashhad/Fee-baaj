"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/api/chat.routes.ts
const express_1 = __importDefault(require("express"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
router.get('/instructor/:insId/messages/summary', controller_1.getUserConversationsForInstructor);
router.get('/instructor/:insId/messages/:userId', controller_1.getInstructorMessages);
router.post('/instructor/:insId/message/:userId', controller_1.postInstructorMessage);
router.get('/instructor/:insId/messages/around/:aroundId', controller_1.getInstructorMessagesAround);
router.get('/message/:messageId', controller_1.getMessageById);
router.get('/instructor/:insId/messages/:studenId/around', controller_1.getInstructorMessagesAround);
router.get('/instructor/:insId/messages/:studenId/around/:aroundId', controller_1.getInstructorMessagesAround);
router.post('/message/:messageId/report', controller_1.reportMessage);
exports.default = router;
