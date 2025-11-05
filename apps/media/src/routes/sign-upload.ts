// routes/upload.ts  (ready-to-drop)
import express, { Router, Request, Response } from 'express';
import formidable from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config';
import { transcodeQueue } from '../worker/transcode-worker';

function normalizeEndpoint(ep?: string | null): string | undefined {
  if (!ep) return undefined;
  ep = String(ep).trim();
  if (!ep) return undefined;
  if (ep.startsWith('http://') || ep.startsWith('https://')) return ep;
  return `https://${ep}`;
}

const s3 = new S3Client({
  region: ENV.S3_REGION || 'us-east-1',
  endpoint: normalizeEndpoint(ENV.S3_ENDPOINT),
  credentials: { accessKeyId: ENV.S3_KEY || '', secretAccessKey: ENV.S3_SECRET || '' },
  forcePathStyle: ENV.S3_FORCE_PATH_STYLE === 'false' ? false : true,
});

const router = Router();
const jsonParser = express.json({ limit: '20mb' }); // per-route JSON parser

// CORS helper for these endpoints (optional - if you already set CORS globally you can remove)
router.use((req, res, next) => {
  const origin = process.env.APP_ORIGIN_ADMIN || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Range,X-Requested-With,x-amz-*');
  res.header('Access-Control-Expose-Headers', 'ETag');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

router.options('*', (_req: Request, res: Response): void => {
  res.sendStatus(200);
});

/** Utility: sanitize file names for S3 keys */
function sanitizeFilename(name: string) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
}

/**
 * Utility: ensureId
 * Normalizes whatever the caller passed into a safe string id.
 * Accepts string, number, objects with ._id or .id, Mongoose ObjectId, etc.
 * Returns undefined when nothing usable.
 */
function ensureId(val: any): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string' && val.trim() !== '') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    // common shapes
    if (val._id) return String(val._id);
    if (val.id) return String(val.id);
    // if object has toString that returns non "[object Object]"
    try {
      const s = String(val);
      if (s && s !== '[object Object]') return s;
    } catch (e) { }
    // fallback to JSON (rare)
    try {
      return JSON.stringify(val);
    } catch (e) {
      return undefined;
    }
  }
  // Anything else
  try {
    return String(val);
  } catch (e) {
    return undefined;
  }
}

// Cache header to set on created uploads (one year, immutable)
const DEFAULT_CACHE_CONTROL = 'private, max-age=0, no-cache, no-store, must-revalidate';

/**
 * sign-multipart — JSON
 * Accepts: { filename, contentType, courseId?, isIntro? }
 * Returns: { ok:true, key, uploadId }
 */
router.post('/sign-multipart', jsonParser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, contentType, courseId, isIntro } = req.body || {};
    if (!filename) {
      res.status(400).json({ ok: false, message: 'filename required' });
      return 
}
    // Build canonical key. If courseId provided, use uploads/videos/courses/{courseId}/<subfolder>/
    const ts = Date.now();
    const uid = uuidv4();
    const sanitized = sanitizeFilename(filename);

    const cid = ensureId(courseId);
    const subfolder = cid ? (isIntro ? 'intro-raw' : 'media-raw') : 'temp';
    const key = cid
      ? `uploads/videos/courses/${cid}/${subfolder}/${uid}-${ts}-${sanitized}`
      : `uploads/temp/${ts}-${uid}-${sanitized}`;

    const create = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: ENV.S3_BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
        CacheControl: DEFAULT_CACHE_CONTROL, // set long cache control for completed object
      })
    );

    res.json({ ok: true, key, uploadId: create.UploadId });
    return
  } catch (err) {
    console.error('sign-multipart', err);
     res.status(500).json({ ok: false, message: 'failed to create multipart upload', detail: String(err) });
     return
  }
});

/**
 * sign-part — JSON
 */
router.post('/sign-part', jsonParser, async (req: Request, res: Response):Promise<void> => {
  try {
    const { key, uploadId, partNumber } = req.body || {};
    if (!key || !uploadId || !partNumber)  {
      res.status(400).json({ ok: false, message: 'missing key/uploadId/partNumber' });
      return
    }

    const cmd = new UploadPartCommand({ Bucket: ENV.S3_BUCKET, Key: key, UploadId: uploadId, PartNumber: Number(partNumber) });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

    // always provide a proxy fallback
    res.json({ ok: true, url, proxy: true, proxyUrl: '/api/upload/proxy-part' });
    return
  } catch (err) {
    console.error('sign-part', err);
    res.status(500).json({ ok: false, message: 'failed to sign part', detail: String(err) });
    return 
  }
});

/**
 * proxy-part — multipart/form-data with fields: key, uploadId, partNumber, file field 'part'
 *
 * Accepts many file-shapes from formidable and falls back to buffer or filepath.
 */
router.post('/proxy-part', async (req: Request, res: Response) => {
  const uploadDir = ENV.TMP_UPLOAD_DIR || path.join(process.cwd(), 'tmp', 'proxy');
  await fs.ensureDir(uploadDir);

  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
    maxFileSize: ENV.MAX_PROXY_PART_SIZE ? Number(ENV.MAX_PROXY_PART_SIZE) : 1024 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('proxy-part parse error', err);
      return res.status(400).json({ ok: false, message: 'Upload failed', detail: err.message });
    }

    try {
      // --- SANITIZE incoming fields (handle arrays from some clients/formidable versions)
      const rawKey = (fields as any)?.key;
      const rawUploadId = (fields as any)?.uploadId;
      const rawPartNumber = (fields as any)?.partNumber ?? (fields as any)?.part;

      const key = Array.isArray(rawKey) ? String(rawKey[0]) : (rawKey !== undefined ? String(rawKey) : undefined);
      const uploadId = Array.isArray(rawUploadId) ? String(rawUploadId[0]) : (rawUploadId !== undefined ? String(rawUploadId) : undefined);
      const partNumber = Array.isArray(rawPartNumber) ? Number(rawPartNumber[0]) : Number(rawPartNumber);

      // find file — many shapes possible
      // normalize incoming file
      let partFile: any = (files as any)?.part || (files as any)?.file || (files as any)?.upload;
      if (!partFile) {
        const keys = Object.keys(files || {});
        if (keys.length > 0) partFile = (files as any)[keys[0]];
      }

      // if it's an array pick the first item (common with multipart libs)
      if (Array.isArray(partFile) && partFile.length > 0) {
        partFile = partFile[0];
      }

      // // debug info
      // console.log('[proxy-part] filesKeys =>', Object.keys(files || {}));
      // console.log('[proxy-part] partFile type =>', Object.prototype.toString.call(partFile));
      // console.log('[proxy-part] partFile keys =>', partFile ? Object.keys(partFile) : 'no partFile');
      // console.log('[proxy-part] possible paths =>', {
      //   filepath: partFile?.filepath,
      //   path: partFile?.path,
      //   tempFilePath: partFile?.tempFilePath,
      //   size: partFile?.size,
      // });

      // required params check
      if (!key || !uploadId || !partNumber || !partFile) {
        if (partFile && (partFile.filepath || partFile.path || partFile.tempFilePath)) {
          await fs.remove(partFile.filepath || partFile.path || partFile.tempFilePath).catch(() => { });
        }
        return res.status(400).json({ ok: false, message: 'missing key, uploadId, partNumber or part file' });
      }

      // pick path / buffer
      const filePath =
        (typeof partFile.filepath === 'string' && partFile.filepath) ||
        (typeof partFile.path === 'string' && partFile.path) ||
        (typeof partFile.tempFilePath === 'string' && partFile.tempFilePath) ||
        undefined;

      const bufferData = partFile.data || partFile.buffer || undefined;

      let Body: any;
      if (bufferData && Buffer.isBuffer(bufferData)) {
        Body = bufferData;
      } else if (filePath) {
        // guarantee path exists
        try {
          await fs.access(filePath);
          Body = fs.createReadStream(filePath);
        } catch (e: any) {
          console.error('filePath does not exist yet or cannot be read:', filePath, e.message);
          return res.status(400).json({ ok: false, message: 'part file not found on server' });
        }
      } else {
        return res.status(400).json({ ok: false, message: 'part file not found on server' });
      }

      // COERCE everything to correct types when calling AWS SDK
      const uploadCmd = new UploadPartCommand({
        Bucket: String(ENV.S3_BUCKET),
        Key: String(key),
        UploadId: String(uploadId),
        PartNumber: Number(partNumber),
        Body
      });

      const result = await s3.send(uploadCmd);

      if (filePath) await fs.remove(filePath).catch(() => { });

      return res.json({ ok: true, ETag: result.ETag || null });
    } catch (e: any) {
      console.error('proxy-part upload error', e);
      return res.status(500).json({ ok: false, message: 'failed to upload part', detail: e?.message || String(e) });
    }
  });

});

/**
 * complete — JSON
 * Accepts: { key, uploadId, parts, filename?, courseId?, lectureId?, isIntro? }
 *
 * IMPORTANT: before enqueuing transcode we remove existing processed intro files for courseId
 * so the new transcode will replace them.
 */
router.post('/complete', jsonParser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, uploadId, parts, filename, courseId, lectureId, isIntro } = req.body || {};
    if (!key || !uploadId || !parts) {
      res.status(400).json({ ok: false, message: 'missing' });
      return
    }

    // 1) Complete multipart
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: ENV.S3_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts.map((p: any) => ({ ETag: p.ETag, PartNumber: Number(p.PartNumber) })) },
      })
    );

    // 2) Clean up previous processed intro outputs if courseId provided
    const courseIdStr = ensureId(courseId.courseId);
    const lectureIdStr = ensureId(lectureId);
    if (courseIdStr) {
      try {
        const prefix = `videos/courses/${courseIdStr}/intro/`;
        const listResp = await s3.send(new ListObjectsV2Command({ Bucket: ENV.S3_BUCKET, Prefix: prefix }));
        const objs = listResp.Contents || [];
        if (objs.length > 0) {
          const deleteParams = {
            Bucket: ENV.S3_BUCKET,
            Delete: { Objects: objs.map((o) => ({ Key: o.Key })) },
          };
          await s3.send(new DeleteObjectsCommand(deleteParams));
          console.log(`[complete] deleted ${objs.length} existing intro objects for course ${courseIdStr}`);
        }
      } catch (e) {
        console.error('complete: failed to delete existing intro objects (non-fatal):', e);
        // continue even if deletion fails
      }
    }

    // 3) enqueue transcode job — pass course/lecture metadata so worker can place result correctly
    const videoId = courseIdStr;
    await transcodeQueue.add(
      'transcode-job',
      {
        videoId,
        s3Key: key,
        bucket: ENV.S3_BUCKET,
        originalName: filename || key,
        courseId: courseIdStr || undefined,   // already normalized
        lectureId: lectureIdStr || undefined, // normalized
        isIntro: !!isIntro,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );

    res.json({ ok: true, videoId, key });
    return
  } catch (err) {
    console.error('complete multipart', err);
    res.status(500).json({ ok: false, message: 'failed to complete upload', detail: String(err) });
    return
  }
});

/**
 * abort — JSON
 */
router.post('/abort', jsonParser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, uploadId } = req.body || {};
    if (!key || !uploadId) {
      res.status(400).json({ ok: false, message: 'missing' })
      return
    };
    await s3.send(new AbortMultipartUploadCommand({ Bucket: ENV.S3_BUCKET, Key: key, UploadId: uploadId }));
    res.json({ ok: true });
    return
  } catch (err) {
    console.error('abort', err);
    res.status(500).json({ ok: false, message: 'failed', detail: String(err) });
    return
  }
});

export default router;
