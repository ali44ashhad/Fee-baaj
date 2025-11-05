import express, { Request, Response } from "express";
import formidable from "formidable";
import fs from "fs/promises";
import crypto from "crypto";
import axios from "axios";
import {
  makeS3ClientImage,
  listKeys,
  deleteKeys,
  putObjectBuffer,
  buildPublicUrlForKey,
} from "../lib/s3-client-image";
import { processProfileImage } from "../utils/image-utils";

const router = express.Router();
const s3 = makeS3ClientImage();
const BUCKET = process.env.S3_BUCKET!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const ADMIN_API_URL = process.env.ADMIN_API_URL || "";
const USER_API_URL = process.env.USER_API_URL || "";
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || "5242880", 10);

function genId(len = 8) {
  return crypto.randomBytes(len).toString("hex");
}
function signPayload(payloadJson: string) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadJson).digest("hex");
}

function pickFirstFile(files: formidable.Files | undefined): formidable.File | undefined {
  if (!files) return undefined;
  const values = Object.values(files) as any[];
  if (values.length === 0) return undefined;
  const first = values[0];
  if (Array.isArray(first)) return first[0] as formidable.File;
  return first as formidable.File;
}

function getTempFilePath(file: formidable.File): string | undefined {
  return (file as any).filepath ?? (file as any).path ?? (file as any).filePath ?? undefined;
}

/**
 * POST /api/media/upload
 * form fields:
 *  - targetType: 'users' | 'instructors' | 'courses'
 *  - targetId: id string
 *  - uploader: optional 'admin' or 'user' (decides webhook target)
 *  multipart file field expected (any name)
 */
router.post("/upload", (req: Request, res: Response) => {
  const form = formidable({ maxFileSize: MAX_UPLOAD_SIZE_BYTES, multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("form parse error", err);
      res.status(400).json({ ok: false, error: "Invalid upload or too large" });
      return;
    }

    try {
      const fileObj = pickFirstFile(files);
      if (!fileObj) {
        res.status(400).json({ ok: false, error: "No file uploaded (expected multipart/form-data)" });
        return;
      }

      const tmpPath = getTempFilePath(fileObj);
      if (!tmpPath) {
        console.error("Uploaded file object missing temp path:", fileObj);
        res.status(400).json({ ok: false, error: "Uploaded file path missing on server" });
        return;
      }

      const rawTargetType = fields?.targetType;
      const rawTargetId = fields?.targetId;
      const rawUploader = fields?.uploader;

      const targetType = Array.isArray(rawTargetType)
        ? String(rawTargetType[0])
        : String(rawTargetType ?? "");
      const targetId = Array.isArray(rawTargetId) ? String(rawTargetId[0]) : String(rawTargetId ?? "");
      const uploader = Array.isArray(rawUploader) ? String(rawUploader[0]) : String(rawUploader ?? "user");

      if (!targetType || !/^(users|instructors|courses)$/.test(targetType)) {
        res.status(400).json({ ok: false, error: "targetType must be 'users', 'instructors' or 'courses'" });
        return;
      }
      if (!targetId) {
        res.status(400).json({ ok: false, error: "targetId required" });
        return;
      }

      // Read file buffer from tmp path
      const buffer = await fs.readFile(tmpPath);

      // Process image, produce normalized + small variant
      // processProfileImage returns { buffers: { normalized, small }, metas: { normalized, small } }
      const { buffers, metas } = await processProfileImage(buffer, { maxWidth: 2048, quality: 80 });

      // Build keys: choose different naming for courses (thumb-) vs user/instructor (profile-)
      const id = genId(8);
      const ts = Date.now();
      const baseNamePrefix = targetType === "courses" ? "thumb" : "profile";
      const baseKey = `images/${targetType}/${targetId}/${baseNamePrefix}-${ts}-${id}.webp`;
      // small variant: for users/instructors keep square 128, for courses choose a landscape thumbnail 640x360
      const smallSuffix = targetType === "courses" ? "-640x360" : "-128x128";
      const smallKey = `images/${targetType}/${targetId}/${baseNamePrefix}-${ts}-${id}${smallSuffix}.webp`;

      // List and delete old keys under prefix (best-effort)
      const prefix = `images/${targetType}/${targetId}/`;
      let oldKeys: string[] = [];
      try {
        oldKeys = await listKeys(s3, BUCKET, prefix);
      } catch (le) {
        console.warn("listKeys failed:", (le as Error).message);
      }

      // Upload new variants with strong cache
      const cacheControl = "public, max-age=31536000, immutable";
      await putObjectBuffer(s3, BUCKET, baseKey, buffers.normalized, "image/webp", cacheControl);
      await putObjectBuffer(s3, BUCKET, smallKey, buffers.small, "image/webp", cacheControl);

      // Delete old keys except the newly created ones
      const keep = new Set([baseKey, smallKey]);
      const keysToDelete = oldKeys.filter((k) => !keep.has(k));
      if (keysToDelete.length > 0) {
        try {
          const delRes = await deleteKeys(s3, BUCKET, keysToDelete);
          console.log("Deleted old keys:", delRes);
        } catch (de) {
          console.warn("deleteKeys error:", (de as Error).message);
        }
      }

      // Attempt to unlink the tmp file (non-critical)
      try {
        await fs.unlink(tmpPath).catch(() => {});
      } catch {}

      // Build public URLs using buildPublicUrlForKey (prefers S3_CDN_URL when present)
      const publicUrl = buildPublicUrlForKey(baseKey);
      const smallUrl = buildPublicUrlForKey(smallKey);

      // Prepare webhook payload — include direct urls
      const payload = {
        targetType,
        targetId,
        key: baseKey,
        url: publicUrl, // direct CDN URL (preferred)
        variants: { small: smallKey, smallUrl },
        meta: { original: metas.normalized, small: metas.small },
        uploadedAt: new Date().toISOString(),
        uploader,
      };
      const payloadJson = JSON.stringify(payload);
      const signature = signPayload(payloadJson);
      const headers = { "Content-Type": "application/json", "x-webhook-signature": `sha256=${signature}` };

      // Send webhook to configured backend (admin or user API)
      const webhookBase = uploader === "admin" && ADMIN_API_URL ? ADMIN_API_URL : USER_API_URL;
      if (!webhookBase) {
        console.warn("no webhook target configured for uploader", uploader);
      } else {
        const webhookUrl = webhookBase.replace(/\/$/, "") + "/internal/uploads/complete";
        // Fire-and-forget but log errors (don't block response excessively)
        axios
          .post(webhookUrl, payload, { headers, timeout: 5000 })
          .then(() => {
            // ok
          })
          .catch((we) => {
            console.error("webhook delivery failed:", (we as Error).message);
            // production: you might queue for retry
          });
      }

      // Respond to uploader with direct public URLs
      res.json({
        ok: true,
        key: baseKey,
        url: publicUrl,
        variants: { small: smallKey, smallUrl },
        meta: payload.meta,
      });
      return;
    } catch (e) {
      console.error("upload error:", (e as Error).message, e);
      res.status(500).json({ ok: false, error: "upload failed" });
      return;
    }
  });
});

export default router;
