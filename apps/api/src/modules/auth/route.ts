// src/modules/auth/route.ts
import express from "express";
import { register, checkAuth, login, logout } from "./controller";

const router = express.Router();

// Register now expects JSON (or application/x-www-form-urlencoded) with optional pictureId/pictureUrl
router.post("/register", register);

router.get("/check", checkAuth);
router.post("/login", login);
router.post("/logout", logout);

export default router;
