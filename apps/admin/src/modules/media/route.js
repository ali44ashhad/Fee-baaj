"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/mediaHooks.ts
const express_1 = require("express");
const controller_1 = require("./controller");
const router = (0, express_1.Router)();
// mount at /api/media/hooks/status
router.post('/hooks/status', controller_1.postMediaStatus);
exports.default = router;
