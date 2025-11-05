// src/modules/internal/route.ts
import express from "express";
import { updateProfile, updatePassword } from "./controller";

const router = express.Router();

// NOTE: we removed multer and any file-handling from the user API.
// Image uploads are handled by the Media Server. This route receives only JSON/form fields.
router.put("/", updateProfile);
router.put("/password", updatePassword);

export default router;
