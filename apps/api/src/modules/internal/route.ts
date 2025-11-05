// src/controllers/uploadsWebhook.ts
import express, { Request, Response } from "express";
import crypto from "crypto";
import { Instructor, User } from "@elearning/models";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/**
 * Verify signature using HMAC-SHA256.
 * header expected like "sha256=<hex>"
 */
function verifySignature(bodyRaw: string, header?: string): boolean {
  const secret = process.env.WEBHOOK_SECRET || "";
  if (!header || !secret) return false;
  const provided = String(header).replace(/^sha256=/i, "");
  const expected = crypto.createHmac("sha256", secret).update(bodyRaw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch (e) {
    return false;
  }
}

/**
 * POST /internal/uploads/complete
 * Body (signed): { targetType, targetId, key, url?, variants?, meta?, uploadedAt, uploader }
 *
 * Behavior:
 * - Prefer payload.url (direct CDN public URL) when present.
 * - Otherwise, if S3_CDN_URL env exists, build `${S3_CDN_URL}/${key}` and use it.
 * - Otherwise fall back to existing MEDIA_BASE_URL proxy (`/media/image?key=...`) for backwards compatibility.
 *
 * Stores:
 *  - pictureId = key
 *  - pictureUrl = chosen public URL
 */
router.post(
  "/uploads/complete",
  express.json({ limit: "64kb" }),
  async (req: Request, res: Response) => {
    const raw = JSON.stringify(req.body || {});
    const sig = req.headers["x-webhook-signature"] as string | undefined;
    if (!verifySignature(raw, sig)) {
      res.status(401).json({ ok: false, error: "invalid signature" });
      return;
    }

    const {
      targetType,
      targetId,
      key,
      url, // preferred direct CDN url from media-server
      variants,
      meta,
      uploadedAt,
      uploader,
    } = req.body as any;

    if (!targetType || !targetId || !key) {
      res.status(400).json({ ok: false, error: "missing fields" });
      return;
    }

    // Determine the public URL to store (prefer payload.url)
    let pictureUrl: string | undefined = undefined;
    if (url && typeof url === "string" && url.trim() !== "") {
      pictureUrl = url;
    } else if (process.env.S3_CDN_URL && String(process.env.S3_CDN_URL).trim() !== "") {
      const cdn = String(process.env.S3_CDN_URL).trim().replace(/\/$/, "");
      pictureUrl = `${cdn}/${key}`.replace(/([^:]\/)\/+/g, "$1");
    } else {
      // fallback to existing proxy behavior for backwards compatibility
      const mediaBase = process.env.MEDIA_BASE_URL || "";
      pictureUrl = mediaBase
        ? `${mediaBase.replace(/\/$/, "")}/media/image?key=${encodeURIComponent(key)}`
        : key;
    }

    try {
      const update = { pictureId: key, pictureUrl, updatedAt: new Date() } as any;

      if (targetType === "users") {
        await User.findByIdAndUpdate(targetId, { $set: update }, { new: true }).exec();
      } else if (targetType === "instructors") {
        await Instructor.findByIdAndUpdate(targetId, { $set: update }, { new: true }).exec();
      } else {
        res.status(400).json({ ok: false, error: "unknown targetType" });
        return;
      }

      res.json({ ok: true });
      return;
    } catch (err) {
      console.error("db update error:", err && (err as Error).message);
      res.status(500).json({ ok: false, error: "db update failed" });
      return;
    }
  }
);

export default router;

