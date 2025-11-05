// src/index.ts
require('module-alias/register');
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';

import uploadRouter from './routes/upload';
import signUploadRouter from './routes/sign-upload';
import stream from './routes/stream-video';

import { ENV } from './config';
import { probeVideo } from './helpers/ffmpeg';
import { downloadFromS3 } from './helpers/s3-download'; // optional, used when ?key= on /api/probe
import imageUploader from "./routes/media-upload"
import imageServer from "./routes/image-serve"
import mediaDelte from "./routes/media-delete";
import imagesDeleteRouter from "./routes/image-delete"

const app = express();

// trust proxy if behind nginx / LB
app.set('trust proxy', 1);

// CORS — echo origin(s) if provided in ENV.APP_ORIGIN
const allowedOrigins = [
  process.env.APP_ORIGIN_ADMIN,
  process.env.APP_ORIGIN_USER,
  process.env.ADMIN_API_URL,
  'http://localhost:3000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (like Postman)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));


// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing (needed for sign-upload JSON bodies)
app.use(express.json({ limit: '100mb' }));

app.use('/api', uploadRouter);
app.use('/api/upload', signUploadRouter);
app.use('/api/media', stream);
app.use('/image', imageUploader);
app.use("/media", imageServer)
app.use("/api/media", mediaDelte)
app.use('/', imagesDeleteRouter); 


app.use(express.urlencoded({ extended: true, limit: '10000mb' }));



// Mount routes:
// - small uploads -> POST /api/upload (uploadRouter exports POST / )
// - multipart signing -> POST /api/upload/sign-multipart etc (signUploadRouter)


// Optional: serve hot HLS folder (if you use /var/hls caching)
if (ENV.HLS_HOT_DIR) {
  try {
    fs.ensureDirSync(ENV.HLS_HOT_DIR);
    app.use('/hot-hls', express.static(ENV.HLS_HOT_DIR));
    console.log('Serving hot HLS from', ENV.HLS_HOT_DIR);
  } catch (e) {
    console.warn('Could not ensure HLS_HOT_DIR', e);
  }
}

/**
 * Probe endpoint
 * - Usage:
 *   GET /api/probe?path=/absolute/local/path.mp4    (for dev / local files)
 *   GET /api/probe?key=uploads/xxx/filename.mp4     (download from S3 then probe)
 */
app.get('/api/probe', async (req: Request, res: Response): Promise<void> => {
  const { path: localPath, key } = req.query as { path?: string; key?: string };
  try {
    if (localPath) {
      // ensure file exists
      if (!(await fs.pathExists(localPath))) {
        res.status(404).json({ ok: false, message: 'local path not found' });
        return
      }
      const meta = await probeVideo(localPath);
      res.json({ ok: true, meta });
      return
    }

    if (key) {
      // requires helpers/s3-download to exist (your worker used this earlier)
      const tmpName = `${path.basename(String(key))}-${Date.now()}`;
      const tmpPath = path.join(ENV.TMP_UPLOAD_DIR || '/tmp', tmpName);
      await fs.ensureDir(ENV.TMP_UPLOAD_DIR || '/tmp');
      await downloadFromS3(ENV.S3_BUCKET, String(key), tmpPath);
      const meta = await probeVideo(tmpPath);
      await fs.remove(tmpPath).catch(() => { });
      res.json({ ok: true, meta });
      return
    }

    res.status(400).json({ ok: false, message: 'expected ?path= or ?key=' });
    return
  } catch (err: any) {
    console.error('probe error', err);
    res.status(500).json({ ok: false, message: err.message || 'probe failed' });
    return
  }
});

// Basic health check
app.get('/health', (req: Request, res: Response) : any=> res.json({ ok: true, ts: Date.now() }));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

// Error handler (last)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Internal Server Error' });
});

// Start server
const port = Number(process.env.PORT || ENV.PORT || 3006);
app.listen(port, () => {
  console.log(`Media server running on port ${port} (NODE_ENV=${process.env.NODE_ENV})`);
});

export default app;
