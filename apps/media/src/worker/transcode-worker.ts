// worker/transcode-worker.ts (updated — ready to drop)
import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import fs from 'fs-extra';
import { ENV } from '../config';
import { transcodeToHLS, Rendition } from '../helpers/ffmpeg';
import { uploadDirToS3 } from '../helpers/s3';
import { downloadFromS3 } from '../helpers/s3-download';
import {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

const connection = new IORedis({
  host: ENV.REDIS_HOST,
  port: Number(ENV.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
});

export const transcodeQueue = new Queue('transcode', { connection });

const TARGETS: Rendition[] = [
  { name: '1080p', height: 1080, maxrate: '1200k', bufsize: '2400k', bandwidth: 0 },
  { name: '720p', height: 720, maxrate: '800k', bufsize: '1600k', bandwidth: 0 },
  { name: '480p', height: 480, maxrate: '500k', bufsize: '1000k', bandwidth: 0 },
  { name: '360p', height: 360, maxrate: '200k', bufsize: '400k', bandwidth: 0 },
];

// Cache policies:
// - Short cache for playlists so updates are seen quickly
// - Long (immutable) cache for media segments
const PLAYLIST_CACHE = 'public, max-age=30, s-maxage=30, must-revalidate';
const SEGMENT_CACHE = 'public, max-age=31536000, immutable';

async function notifyAdmin(videoId: string | undefined, payload: any) {
  const url = process.env.ADMIN_API_URL;
  const key = process.env.ADMIN_API_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url.replace(/\/$/, '')}/media/hooks/status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ videoId, ...payload }),
    });
  } catch (err) {
    console.warn('notifyAdmin failed (non-fatal):', (err as any)?.message || err);
  }
}

function makeS3Client() {
  const endpoint = (ENV.S3_ENDPOINT || '').toString().trim();
  const cfg: any = {
    region: ENV.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: ENV.S3_KEY || '',
      secretAccessKey: ENV.S3_SECRET || '',
    },
  };
  if (endpoint) {
    cfg.endpoint = endpoint.startsWith('http://') || endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`;
    cfg.forcePathStyle = ENV.S3_FORCE_PATH_STYLE === 'false' ? false : true;
  }
  return new S3Client(cfg);
}

const s3client = makeS3Client();

function ensureString(v: any) {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function contentTypeForKey(key: string | undefined) {
  if (!key) return undefined;
  const ext = path.extname(key).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.m4s' || ext === '.mp4') return 'video/mp4';
  if (ext === '.ts') return 'video/MP2T';
  if (ext === '.aac') return 'audio/aac';
  return undefined;
}

/**
 * Update Cache-Control and ContentType metadata under a prefix.
 * - playlists (.m3u8) -> PLAYLIST_CACHE (short)
 * - segments (.ts) -> SEGMENT_CACHE (long)
 * This uses CopyObject to replace metadata (best-effort).
 */
async function ensureCacheControlOnPrefix(bucket: string, prefix: string) {
  try {
    let continuationToken: string | undefined = undefined;
    do {
      const listed = await s3client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));
      const items = listed.Contents || [];

      for (const obj of items) {
        try {
          if (!obj.Key) continue;
          const key = obj.Key;
          // choose cache based on extension
          const ext = path.extname(key).toLowerCase();
          const cache = ext === '.m3u8' ? PLAYLIST_CACHE : ext === '.ts' ? SEGMENT_CACHE : SEGMENT_CACHE;
          const ct = contentTypeForKey(key);

          // Build CopyInput; CopySource must be encoded (bucket/key)
          const copyInput: any = {
            Bucket: bucket,
            CopySource: `${bucket}/${encodeURIComponent(key)}`,
            Key: key,
            MetadataDirective: 'REPLACE',
            CacheControl: cache,
          };
          if (ct) copyInput.ContentType = ct;

          await s3client.send(new CopyObjectCommand(copyInput));
        } catch (inner) {
          console.warn(`ensureCacheControlOnPrefix: failed updating metadata for ${obj.Key}:`, (inner as any)?.message || inner);
        }
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (e) {
    console.warn('ensureCacheControlOnPrefix: listing or metadata update failed (non-fatal):', (e as any)?.message || e);
  }
}

function normalizeBaseUrl(raw?: string | null) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  if (!s.startsWith('http://') && !s.startsWith('https://')) s = `https://${s}`;
  return s.replace(/\/$/, '');
}

const worker = new Worker(
  'transcode',
  async (job) => {
    const data = job.data as any;
    let sourcePath: string | undefined = data.localPath;
    const displayName = data.originalName || path.basename(String(sourcePath || data.s3Key || 'upload'));
    const videoId = ensureString(data.videoId) || undefined;
    const courseId = ensureString(data.courseId) || undefined;
    const lectureId = ensureString(data.lectureId) || undefined;
    const isIntro = !!data.isIntro;

    const progress = async (meta: any) => {
      try {
        const enriched = { ...meta, courseId, videoJobId: videoId, lectureId };
        await job.updateProgress(enriched).catch(() => { });
        await notifyAdmin(videoId, enriched);
      } catch (_) { }
    };

    await progress({ step: 'queued', pct: 1 });

    let downloadedTmp = '';
    if (!sourcePath && data.s3Key) {
      const ext = path.extname(String(data.s3Key)) || '.mp4';
      const tmpName = `${data.videoId || 'job'}-${Date.now()}${ext}`;
      sourcePath = path.join(ENV.TMP_UPLOAD_DIR || '/tmp', tmpName);
      await fs.ensureDir(ENV.TMP_UPLOAD_DIR || '/tmp');
      await progress({ step: 'downloading', pct: 5 });
      await downloadFromS3(data.bucket || ENV.S3_BUCKET, data.s3Key, sourcePath);
      downloadedTmp = sourcePath;
      await progress({ step: 'downloaded', pct: 10 });
    }

    if (!sourcePath) {
      throw new Error('No sourcePath provided to worker (localPath or s3Key required)');
    }

    try {
      const workRoot = path.join(ENV.HLS_TMP_ROOT || '/tmp/hls', `${videoId || 'job'}-${Date.now()}`);
      await fs.ensureDir(workRoot);

      await progress({ step: 'transcoding', pct: 12 });
      const { outDir, masterPlaylist, renditions } = await transcodeToHLS(sourcePath, workRoot, TARGETS);
      await progress({ step: 'transcoding', pct: 60 });

      let destPrefix = '';
      if (courseId) {
        if (lectureId) destPrefix = `videos/courses/${courseId}/lectures/${lectureId}`;
        else if (isIntro) destPrefix = `videos/courses/${courseId}/intro`;
        else destPrefix = `videos/courses/${courseId}/${videoId || path.basename(sourcePath, path.extname(sourcePath))}`;
      } else {
        const slug = videoId || path.basename(sourcePath, path.extname(sourcePath));
        destPrefix = `videos/${slug}`;
      }

      await progress({ step: 'uploading', pct: 65 });
      await uploadDirToS3(ENV.S3_BUCKET, outDir, destPrefix);
      await progress({ step: 'uploaded', pct: 90, s3Prefix: destPrefix });

      // Optional: delete original uploaded full file from S3
      if (data.s3Key && process.env.DELETE_ORIGINAL_AFTER_TRANSCODE === 'true') {
        try {
          const delKey = String(data.s3Key);
          const bucket = String(data.bucket || ENV.S3_BUCKET);
          const delCmd = new DeleteObjectCommand({ Bucket: bucket, Key: delKey });
          await s3client.send(delCmd);
        } catch (delErr: any) {
          console.warn(`Job ${job.id}: failed to delete original S3 object (non-fatal):`, (delErr && delErr.message) || delErr);
        }
      }

      // IMPORTANT: Ensure Cache-Control metadata per-file-type under the prefix
      try {
        await ensureCacheControlOnPrefix(ENV.S3_BUCKET, destPrefix);
      } catch (e) {
        console.warn('Job metadata update failed (non-fatal):', (e as any)?.message || e);
      }

      // hot cache copy (best-effort)
      try {
        const hotDir = path.join('/var/hls', videoId || path.basename(sourcePath, path.extname(sourcePath)));
        await fs.ensureDir(hotDir);
        if (await fs.pathExists(path.join(outDir, 'master.m3u8'))) {
          await fs.copy(path.join(outDir, 'master.m3u8'), path.join(hotDir, 'master.m3u8'));
        }
        for (const r of renditions) {
          const rendPath = path.join(outDir, r.name);
          if (await fs.pathExists(rendPath)) {
            const segs = (await fs.readdir(rendPath)).filter((s) => s.endsWith('.ts')).slice(0, 2);
            for (const s of segs) await fs.copy(path.join(rendPath, s), path.join(hotDir, s));
            const playlistFile = path.join(rendPath, 'playlist.m3u8');
            if (await fs.pathExists(playlistFile)) {
              await fs.copy(playlistFile, path.join(hotDir, `${r.name}_playlist.m3u8`));
            }
          }
        }
      } catch (e) {
        console.warn('hot cache copy failed (non-fatal):', (e as any)?.message || e);
      }

      // cleanup local files
      try {
        if (downloadedTmp) await fs.remove(downloadedTmp).catch(() => { });
        else await fs.remove(sourcePath).catch(() => { });
        await fs.remove(outDir).catch(() => { });
        await fs.remove(workRoot).catch(() => { });
      } catch (cleanupErr) {
        console.warn(`Job ${job.id}: cleanup issue:`, (cleanupErr as any).message || cleanupErr);
      }

      // Build playback URL (prefer CDN env var if provided)
      let playbackUrl = '';
      const cdn = (ENV.S3_CDN_URL || '').toString().trim().replace(/\/$/, '');
      if (cdn) {
        playbackUrl = `${cdn}/${destPrefix}/master.m3u8`.replace(/([^:]\/)\/+/g, '$1');
      } else {
        const endpoint = (ENV.S3_ENDPOINT || '').toString().replace(/\/$/, '');
        if (endpoint) {
          const base = endpoint.startsWith('http://') || endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`;
          playbackUrl = `${base}/${destPrefix}/master.m3u8`.replace(/([^:]\/)\/+/g, '$1');
        } else {
          playbackUrl = `${destPrefix}/master.m3u8`;
        }
      }

      // Append cache-busting query so clients that already cached can revalidate
      const versionedPlaybackUrl = `${playbackUrl}${playbackUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

      // notify admin API about completion (admin will update DB)
      await notifyAdmin(videoId, {
        step: 'done',
        pct: 100,
        s3Prefix: destPrefix,
        playbackUrl: versionedPlaybackUrl,
        courseId,
        lectureId,
        isIntro,
      });

      await progress({ step: 'done', pct: 100, s3Prefix: destPrefix, playbackUrl: versionedPlaybackUrl });
      console.log(`Job ${job.id}: finished successfully`);
      return { ok: true, destPrefix, playbackUrl: versionedPlaybackUrl };
    } catch (err) {
      console.error(`Job ${job.id} failed`, err);
      await progress({ step: 'failed', pct: 0, error: String(err) }).catch(() => { });
      throw err;
    }
  },
  { connection, concurrency: Number(ENV.WORKER_CONCURRENCY || 1) }
);

worker.on('completed', (job) => console.log('Worker completed job', job?.id));
worker.on('failed', (job, err) => console.error('Worker failed job', job?.id, err));

export default worker;
