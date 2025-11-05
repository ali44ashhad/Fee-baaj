// src/routes/upload.ts
import { Router } from 'express';
import formidable from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mimeLib from 'mime-types';
import { transcodeQueue } from '../worker/transcode-worker';
import { ENV } from '../config';
import { probeVideo } from '../helpers/ffmpeg';

type AnyFile = { [k: string]: any };

const ALLOWED_EXTS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mpeg', 'ts'];
const ALLOWED_MIMES = [
  'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm', 'video/x-matroska',
  'video/x-msvideo', 'video/mpeg', 'video/MP2T'
];

const router = Router();

function unwrapRaw(raw: AnyFile | AnyFile[] | null): AnyFile | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw.raw && Array.isArray(raw.raw) && raw.raw.length > 0) return raw.raw[0];
  if (raw.files && Array.isArray(raw.files) && raw.files.length > 0) return raw.files[0];
  return raw;
}

function normalizeFileObject(rawInput: AnyFile | null) {
  const raw = unwrapRaw(rawInput);
  if (!raw) return null;
  const filepath =
    raw.filepath ||
    raw.filePath ||
    raw.path ||
    raw.tempFilePath ||
    raw.tmpName ||
    raw.temp ||
    raw.tempFile ||
    raw._writeStream?.path ||
    '';
  const originalFilename =
    raw.originalFilename ||
    raw.originalname ||
    raw.name ||
    raw.filename ||
    raw.fileName ||
    raw.originalFileName ||
    '';
  const newFilename = raw.newFilename || path.basename(String(filepath || '')) || '';
  const mimetype = (raw.mimetype || raw.type || raw.mime || '').toLowerCase();
  const size = Number(raw.size || raw.length || raw._writeStream?.bytesWritten || 0);
  return { filepath, originalFilename, newFilename, mimetype, size, raw };
}

function pickFirstFile(filesObj: AnyFile | undefined) {
  if (!filesObj) return null;
  const keys = Object.keys(filesObj);
  if (keys.length === 0) return null;
  const first = (filesObj as any)[keys[0]];
  if (Array.isArray(first)) return first[0] || null;
  return first || null;
}

/**
 * Helper: normalize a field that may be string | string[] | boolean | undefined
 * Returns string | undefined
 */
function fieldToString(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return String(v);
}

/**
 * Helper: robust boolean check for common truthy values ('true','1','on', true)
 */
function parseBoolField(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = fieldToString(v);
  if (!s) return false;
  const low = s.trim().toLowerCase();
  return low === 'true' || low === '1' || low === 'on' || low === 'yes';
}

router.post('/upload', async (req, res): Promise<void> => {
  const uploadDir = ENV.TMP_UPLOAD_DIR || path.join(process.cwd(), 'tmp', 'uploads');
  await fs.ensureDir(uploadDir);

  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
    maxFileSize: 11 * 1024 * 1024 * 1024, // 11GB
    filename: (name, ext /* .mp4 etc */, part) => {
      // keep a temporary unique filename here; we'll rename/move later
      const extNormalized = ext || '';
      return `${Date.now()}-${uuidv4()}${extNormalized}`;
    },
  });

  form.on('error', (err) => {
    console.error('[upload] formidable error', err);
  });

  try {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[upload] parse error', err);
        return res.status(400).json({ ok: false, message: 'Upload failed', detail: err.message });
      }

      // Very explicit logging for debugging (remove or reduce in prod)
      console.log('[upload] parse fields (raw):', fields);
      console.log('[upload] parse files keys:', Object.keys(files || {}));

      // get the uploaded file
      let rawFile = (files as any)?.file || (files as any)?.video || (files as any)?.upload || null;
      if (!rawFile) {
        rawFile = pickFirstFile(files as any);
        if (rawFile) console.log('[upload] using file from unexpected field');
      }

      // fallback: raw body (rare)
      if (!rawFile) {
        const contentType = String(req.headers['content-type'] || '').toLowerCase();
        if (contentType.startsWith('video/') || contentType === 'application/octet-stream') {
          try {
            const extGuess = contentType.startsWith('video/') ? (mimeLib.extension(contentType) || '') : '';
            const tmpName = `${uuidv4()}${extGuess ? '.' + extGuess : ''}`;
            const tmpPath = path.join(uploadDir, tmpName);
            const ws = fs.createWriteStream(tmpPath);
            req.pipe(ws);
            await new Promise<void>((resolve, reject) => {
              ws.on('finish', resolve);
              ws.on('error', reject);
              req.on('error', reject);
            });
            const stats = await fs.stat(tmpPath);
            rawFile = {
              filepath: tmpPath,
              newFilename: tmpName,
              originalFilename: tmpName,
              mimetype: contentType,
              size: stats.size,
            };
            console.log('[upload] saved raw request body to', tmpPath);
          } catch (e: any) {
            console.error('[upload] failed to save raw body', e);
            return res.status(500).json({ ok: false, message: 'Failed saving raw upload', detail: e?.message });
          }
        }
      }

      if (!rawFile) {
        return res.status(400).json({
          ok: false,
          message:
            'No file provided. Send multipart/form-data with field "file" or "video", or send raw video body with appropriate Content-Type.',
        });
      }

      const file = normalizeFileObject(rawFile);
      if (!file) return res.status(400).json({ ok: false, message: 'Invalid upload file object' });

      // --- Normalize fields robustly ---
      const rawCourseId = fieldToString((fields as any)?.courseId || (fields as any)?.course_id);
      const rawLectureId = fieldToString((fields as any)?.lectureId || (fields as any)?.lecture_id);
      const rawIsIntro = (fields as any)?.isIntro ?? (fields as any)?.intro ?? undefined;

      const courseId = rawCourseId;
      const lectureId = rawLectureId;
      const isIntro = parseBoolField(rawIsIntro);

      // Debug log to make sure we actually see the flag
      console.log(`[upload] normalized fields -> courseId=${courseId}, lectureId=${lectureId}, isIntro=${isIntro}`);

      // choose folder name based on isIntro (fallback to 'lecture' if unspecified)
      const folderName = isIntro ? 'intro' : 'lecture';
      const finalUploadDir = path.join(uploadDir, folderName);
      await fs.ensureDir(finalUploadDir, { mode: 0o755 });

      // build a readable final filename: timestamp-original.ext (avoid collisions)
      const originalName = file.originalFilename || file.newFilename || path.basename(file.filepath || 'upload');
      const safeOriginal = originalName.replace(/\s+/g, '_'); // small sanitize
      const finalFilename = `${Date.now()}-${safeOriginal}`;
      const finalPath = path.join(finalUploadDir, finalFilename);

      // move temp file -> final folder (overwrite defensively)
      try {
        await fs.move(file.filepath, finalPath, { overwrite: true });
      } catch (moveErr) {
        console.error('[upload] move failed', moveErr);
        // try copy as fallback
        await fs.copy(file.filepath, finalPath).catch(() => { });
        await fs.remove(file.filepath).catch(() => { });
      }

      file.filepath = finalPath;
      file.newFilename = finalFilename;

      // ext/mime detect & validate
      let ext = path.extname(finalFilename).replace('.', '').toLowerCase();
      let mime = (file.mimetype || '').toLowerCase();
      if (!mime) mime = (mimeLib.lookup(finalFilename) || '').toLowerCase();

      if (!file.filepath || !(await fs.pathExists(file.filepath))) {
        console.error('[upload] missing filepath or file not found', file);
        return res.status(400).json({ ok: false, message: 'Uploaded file not found on server' });
      }

      // size fallback
      let size = Number(file.size || 0);
      if (!size) {
        try {
          const st = await fs.stat(file.filepath);
          size = st.size;
        } catch (e) {
          console.warn('[upload] could not stat file to get size', e);
        }
      }

      const threshold = Number(ENV.DIRECT_UPLOAD_THRESHOLD_BYTES || 200 * 1024 * 1024);
      console.log('[upload] threshold', threshold, 'size', size);
      if (size > threshold) {
        await fs.remove(file.filepath).catch(() => { });
        return res.status(413).json({
          ok: false,
          reason: 'LARGE_FILE',
          message: `File is larger than the server-side threshold (${threshold} bytes). Please use direct-to-object-storage multipart upload.`,
          directUploadEndpoint: '/api/upload/sign-multipart',
        });
      }

      if (!(ext && ALLOWED_EXTS.includes(ext)) && !(mime && ALLOWED_MIMES.includes(mime))) {
        await fs.remove(file.filepath).catch(() => { });
        return res.status(400).json({ ok: false, message: 'Unsupported file type', ext, mime });
      }

      // Validate video with ffprobe
      try {
        const meta = await probeVideo(file.filepath);
        if (!meta || !meta.height || !meta.width) {
          await fs.remove(file.filepath).catch(() => { });
          return res.status(400).json({ ok: false, message: 'Invalid video file' });
        }

        const videoId = courseId;
        const originalNameForQueue = file.originalFilename || path.basename(file.filepath);

        // enqueue transcode job with isIntro properly set
        await transcodeQueue.add(
          'transcode-job',
          {
            videoId,
            localPath: file.filepath,
            originalName: originalNameForQueue,
            courseId: courseId || undefined,
            lectureId: lectureId || undefined,
            isIntro: !!isIntro,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
        );

        // return helpful debug info
        return res.json({
          ok: true,
          videoId,
          folder: folderName,
          filename: finalFilename,
          parsed: { courseId, lectureId, isIntro },
        });
      } catch (probeErr: any) {
        console.error('[upload] probe failed', probeErr);
        await fs.remove(file.filepath).catch(() => { });
        return res.status(400).json({ ok: false, message: 'Could not process video', detail: probeErr?.message || probeErr });
      }
    });
  } catch (outerErr: any) {
    console.error('[upload] unexpected', outerErr);
    res.status(500).json({ ok: false, message: 'Internal error', detail: outerErr?.message });
    return
  }
});

export default router;
