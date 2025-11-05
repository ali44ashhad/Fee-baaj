// src/controllers/image-serve.ts
import express, { Request, Response } from "express";
import { makeS3ClientImage, getObjectStream } from "../lib/s3-client-image";
import { asyncHandler } from '../lib/async-handler';


const router = express.Router();
const s3 = makeS3ClientImage();
const BUCKET = process.env.S3_BUCKET!;

/**
 * GET /media/image?key=<s3-key>
 * Streams object from S3 through the media server (no CDN exposure).
 */
router.get("/image", asyncHandler(async (req, res): Promise<void> => {
  const key = String(req.query.key || "");
  if (!key) {
    res.status(400).send("key required");
    return
  }

  try {
    const { stream, contentType, contentLength } = await getObjectStream(s3, BUCKET, key);
    if (contentType) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", String(contentLength));

    // caching: these are versioned filenames, safe to set long cache
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    stream.pipe(res);
  } catch (err: any) {
    console.error("stream error:", err && err.message ? err.message : err);
    if (String(err?.message || "").includes("NoSuchKey") || String(err?.$metadata?.httpStatusCode) === "404") {
      res.status(404).send("Not found");
    } else {
      res.status(500).send("failed to fetch image");
    }
  }
}));

export default router;
