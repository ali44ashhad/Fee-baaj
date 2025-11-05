// src/routes/media.ts
import express from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import stream from 'stream';
import { pipeline } from 'stream/promises';
import { ENV } from '../config';
import path from 'path';

const router = express.Router();

// normalize endpoint helper
function normalizeEndpoint(ep?: string | null): string | undefined {
  if (!ep) return undefined;
  ep = String(ep).trim();
  if (!ep) return undefined;
  if (ep.startsWith('http://') || ep.startsWith('https://')) return ep;
  return `https://${ep}`;
}

const s3 = new S3Client({
  region: ENV.S3_REGION || 'eu-central-1',
  endpoint: normalizeEndpoint(ENV.S3_ENDPOINT),
  credentials: {
    accessKeyId: ENV.S3_KEY || '',
    secretAccessKey: ENV.S3_SECRET || '',
  },
  // FORCE PATH STYLE: make sure this is true to avoid bucket-as-subdomain (fixes CERT name issues)
  forcePathStyle: (String(ENV.S3_FORCE_PATH_STYLE || 'true') === 'true'),
});

// helper to compute dest prefix (same logic you used)
function destPrefixFor({ courseId, lectureId, isIntro }: { courseId?: string, lectureId?: string, isIntro?: boolean }) {
  if (!courseId) return '';
  if (lectureId) return `videos/courses/${courseId}/lectures/${lectureId}`;
  if (isIntro) return `videos/courses/${courseId}/intro`;
  return `videos/courses/${courseId}`;
}

/**
 * playback-url: returns either CDN URL (if set) or proxied server URL.
 * Query: courseId (required), lectureId (opt), isIntro (opt boolean)
 */
router.get('/playback-url', async (req, res): Promise<void> => {
  try {
    const { courseId, lectureId, isIntro } = req.query as any;
    if (!courseId) {
      res.status(400).json({ ok: false, message: 'courseId required' });
      return
    }

    const prefix = destPrefixFor({ courseId, lectureId, isIntro: isIntro === 'true' || isIntro === true });
    const key = `${prefix}/master.m3u8`;

    // If you have a CDN that serves the bucket at CDN_BASE_URL, prefer that
    const cdn = (process.env.CDN_BASE_URL || '').replace(/\/$/, '');
    if (cdn) {
      res.json({ ok: true, url: `${cdn}/${key}` });
      return
    }

    // fallback to proxied URL served by this server.
    // MEDIA_PUBLIC_URL should be the public origin for this media server (e.g. http://localhost:3006)
    const base = (ENV.MEDIA_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const proxied = `${base}/api/media/hls/${encodeURIComponent(key)}`;
    res.json({ ok: true, url: proxied });
    return
  } catch (err: any) {
    console.error('playback-url', err);
    res.status(500).json({ ok: false, message: 'failed', detail: String(err) });
    return
  }
});

/**
 * Proxy /api/media/hls/*  => fetch object from S3 and stream to client.
 * Example: GET /api/media/hls/videos/courses/COURSEID/intro/master.m3u8
 *
 * This returns CORS headers and content-type. It maps the URL path after /hls/ directly to the S3 key.
 */
router.options('/hls/*', (req, res) => {
  const origin = (process.env.APP_ORIGIN_USER || '*');
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range,Content-Type,Authorization');
  res.sendStatus(204);
});

router.get('/hls/*', async (req, res): Promise<void> => {
  try {
    const origin = (process.env.APP_ORIGIN_USER || '*');
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Range,Content-Type,Authorization');

    let key = (req.params[0] || '').replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (e) { /* ignore */ }
    if (!key) {
      res.status(400).send('missing key');
      return
    }

    console.log('S3 key we fetch:', key);

    if (key.endsWith('.m3u8')) {
      res.type('application/vnd.apple.mpegurl');
    } else if (key.endsWith('.ts')) {
      res.type('video/mp2t');
    } else {
      res.type('application/octet-stream');
    }

    const cmd = new GetObjectCommand({ Bucket: String(ENV.S3_BUCKET), Key: `${key}` });
    const s3Resp = await s3.send(cmd);
    const body = s3Resp.Body as any;
    if (!body) {
      res.status(404).send('not found');
      return
    }

    if (s3Resp.ContentLength) res.setHeader('Content-Length', String(s3Resp.ContentLength));
    if (s3Resp.ContentType) res.setHeader('Content-Type', String(s3Resp.ContentType));

    //  robust playlist rewriting to absolute proxied paths ---
    if (key.endsWith('.m3u8')) {
      let text = '';
      if (body instanceof stream.Readable || typeof body.pipe === 'function') {
        for await (const chunk of body) { text += chunk.toString(); }
      } else if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
        text = Buffer.from(body).toString('utf8');
      } else if (typeof body.text === 'function') {
        text = await body.text();
      } else if (typeof body.arrayBuffer === 'function') {
        const ab = await body.arrayBuffer();
        text = Buffer.from(ab).toString('utf8');
      } else {
        text = String(body);
      }

      // dirname of this playlist in S3 (no trailing slash)
      const dir = path.posix.dirname(key).replace(/\/$/, '');

      // Proxy base path we expose to the browser
      const proxyBase = '/api/media/hls/';

      const lines = text.split(/\r?\n/);
      const rewritten = lines.map((ln) => {
        if (!ln || ln.trim().length === 0) return ln;
        if (ln.startsWith('#')) return ln; // tag/comment

        const trimmed = ln.trim();

        // If it's already an absolute HTTP(S) URL, leave untouched
        if (/^https?:\/\//i.test(trimmed)) return ln;

        // If it's already a proxied path or absolute path to our API, leave untouched
        if (trimmed.startsWith(proxyBase) || trimmed.startsWith('/' + proxyBase.replace(/^\/+/, ''))) {
          return ln;
        }

        // Construct the S3 key for this resource:
        // - if the playlist line is already an S3-like key (starts with "videos/" etc) use it
        // - otherwise join with the playlist dirname
        let targetS3Key = '';
        if (/^[^\/]+\/.+/.test(trimmed)) {
          // looks like a path (no scheme) - treat as either relative path or already a key
          // if trimmed is an absolute-like key that already begins with dir, use trimmed
          if (dir && trimmed.startsWith(dir + '/')) {
            targetS3Key = trimmed;
          } else if (trimmed.startsWith(dir)) {
            // handle corner case where trimmed equals dir +something
            targetS3Key = trimmed;
          } else {
            // relative path -> prefix with dir
            targetS3Key = dir ? `${dir}/${trimmed}` : trimmed;
          }
        } else {
          // fallback: prefix with dir
          targetS3Key = dir ? `${dir}/${trimmed}` : trimmed;
        }

        // Return an absolute proxied path so browser requests exact key (encoded)
        const proxied = `${proxyBase}${encodeURIComponent(targetS3Key)}`;
        return proxied;
      });

      const out = rewritten.join('\n');
      res.setHeader('Content-Length', Buffer.byteLength(out, 'utf8'));
      res.send(out);
      return;
    }

    // non-playlist -> stream as-is
    if (body instanceof stream.Readable || typeof body.pipe === 'function') {
      await pipeline(body, res);
      return;
    }

    if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
      res.end(Buffer.from(body));
      return;
    }

    const buf = Buffer.from(await (body.arrayBuffer?.() || []));
    res.end(buf);
  } catch (err: any) {
    console.error('media/hls proxy error', err);
    res.status(500).json({ ok: false, message: 'failed to proxy', detail: String(err?.message || err) });
    return
  }
});

export default router;
