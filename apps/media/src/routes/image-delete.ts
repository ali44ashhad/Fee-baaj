// src/controllers/imagesDelete.ts

/**
 * Admin route to delete images for users, instructors, or courses.
 *
 * POST /internal/images/delete
 * Body JSON:
 * {
 * "targetType": "users" | "instructors" | "courses",
 * "targetId": "<id>",
 * // optional single key to delete (full object key in bucket), otherwise the entire prefix will be removed:
 * "key": "images/users/<id>/profile-...webp"
 * }
 *
 * NOTE: This is an admin-only endpoint. It's mounted inside the admin API.
 *     It does NOT call the public media server; it deletes directly from S3/R2 using server credentials.
 *
 * Environment:
 * - S3_KEY, S3_SECRET, S3_REGION, S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_BUCKET
 * - ADMIN_API_URL (REQUIRED for webhook)
 * - WEBHOOK_SECRET (REQUIRED for webhook)
 * - (optional) REQUIRE_INTERNAL_DELETE_AUTH = "true" 	-> route will require Authorization: Bearer <ADMIN_API_KEY>
 * - ADMIN_API_KEY (used only if REQUIRE_INTERNAL_DELETE_AUTH === "true")
 */
import { Router, Request, Response } from 'express';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

const ADMIN_API_URL = process.env.ADMIN_API_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function normalizeEndpoint(ep?: string | null): string | undefined {
  if (!ep) return undefined;
  ep = String(ep).trim();
  if (!ep) return undefined;
  if (ep.startsWith('http://') || ep.startsWith('https://')) return ep.replace(/\/$/, '');
  return `https://${ep}`.replace(/\/$/, '');
}

function makeS3ClientFromEnv() {
  const endpoint = normalizeEndpoint(process.env.S3_ENDPOINT);
  const cfg: any = {
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_KEY || '',
      secretAccessKey: process.env.S3_SECRET || '',
    },
  };
  if (endpoint) {
    cfg.endpoint = endpoint;
    cfg.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'false' ? false : true;
  }
  return new S3Client(cfg);
}

function signPayload(payloadJson: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadJson).digest('hex');
}

// Function to send the webhook after successful deletion
async function sendDeleteWebhook(targetType: string, targetId: string) {
  if (!ADMIN_API_URL || !WEBHOOK_SECRET) {
    console.warn('imagesDelete: ADMIN_API_URL or WEBHOOK_SECRET not configured for delete webhook.');
    return;
  }

  const payload = {
    targetType,
    targetId,
    deletedAt: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);
  const signature = signPayload(payloadJson);
  const headers = { 'Content-Type': 'application/json', 'x-webhook-signature': `sha256=${signature}` };

  const webhookUrl = ADMIN_API_URL.replace(/\/$/, '') + '/internal/images/deleted';
  console.log(`Sending delete webhook to ${webhookUrl} for ${targetType}:${targetId}`);

  try {
    // Fire-and-forget webhook with a short timeout
    await axios.post(webhookUrl, payload, { headers, timeout: 5000 });
  } catch (e: any) {
    console.error('delete webhook delivery failed:', e.message);
  }
}

const s3 = makeS3ClientFromEnv();
const BUCKET = process.env.S3_BUCKET || '';

if (!BUCKET) {
  console.warn('imagesDelete: S3_BUCKET not configured in env — route will fail if used.');
}

async function listAllKeys(bucket: string, prefix: string) {
  const keys: string[] = [];
  let ContinuationToken: string | undefined = undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
        MaxKeys: 1000,
      })
    );
    const contents = resp.Contents || [];
    for (const c of contents) {
      if (c.Key) keys.push(c.Key);
    }
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

async function deleteKeysBatch(bucket: string, keys: string[]) {
  if (!keys || keys.length === 0) return { deleted: 0, errors: [] as any[] };
  const toDelete = keys.map((k) => ({ Key: k }));
  const input: DeleteObjectsCommandInput = {
    Bucket: bucket,
    Delete: { Objects: toDelete, Quiet: false },
  };
  const resp = await s3.send(new DeleteObjectsCommand(input));
  const deleted = resp.Deleted || [];
  const errs = resp.Errors || [];
  return { deleted: deleted.length, errors: errs.map((e) => ({ Key: e.Key, Code: e.Code, Message: e.Message })) };
}

async function deletePrefix(bucket: string, prefix: string) {
  const result = { prefix, attempted: 0, deleted: 0, errors: [] as any[] };
  try {
    const allKeys = await listAllKeys(bucket, prefix);
    result.attempted = allKeys.length;
    // Delete in chunks of 1000
    for (let i = 0; i < allKeys.length; i += 1000) {
      const chunk = allKeys.slice(i, i + 1000);
      try {
        const r = await deleteKeysBatch(bucket, chunk);
        result.deleted += r.deleted;
        if (r.errors && r.errors.length) result.errors.push(...r.errors);
      } catch (e: any) {
        result.errors.push({ message: `chunk delete failed: ${String(e?.message || e)}` });
      }
    }
  } catch (err: any) {
    result.errors.push({ message: `list/delete failed: ${String(err?.message || err)}` });
  }
  return result;
}

/**
 * POST /internal/images/delete
 */
router.post('/images/delete', async (req: Request, res: Response): Promise<void> => {
  try {
    // Optional protection: if REQUIRE_INTERNAL_DELETE_AUTH === "true" the caller must pass admin bearer token.
    if (String(process.env.REQUIRE_INTERNAL_DELETE_AUTH || '').toLowerCase() === 'true') {
      const auth = (req.headers.authorization || '').trim();
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ ok: false, message: 'Unauthorized' });
        return
      }
      const token = auth.slice(7);
      if (token !== process.env.ADMIN_API_KEY) {
        res.status(403).json({ ok: false, message: 'Forbidden' });
        return
      }
    }

    const { targetType, targetId, key } = req.body || {};

    // IMPORTANT: Allow 'courses' now
    if (!targetType || !/^(users|instructors|courses)$/.test(String(targetType))) {
      res.status(400).json({ ok: false, message: 'targetType required: "users", "instructors" or "courses"' });
      return
    }
    if (!targetId && !key) {
      res.status(400).json({ ok: false, message: 'targetId or key required' });
      return
    }

    if (!BUCKET) {
      res.status(500).json({ ok: false, message: 'S3_BUCKET not configured' });
      return
    }

    // --- Delete Single Key ---
    if (key && typeof key === 'string' && key.trim() !== '') {
      try {
        const resp = await deleteKeysBatch(BUCKET, [key]);
        
        // NOTE: For single key delete, we don't automatically fire the targetId webhook 
        // as we don't know if the key was the primary image/thumbnail.
        res.json({ ok: true, message: 'single key delete attempted', result: resp });
        return
      } catch (err: any) {
        console.error('imagesDelete single key error', err);
        res.status(500).json({ ok: false, message: String(err?.message || err) });
        return
      }
    }

    // --- Delete Prefix ---
    // Prefix format is images/<targetType>/<targetId>/
    const prefix = `images/${targetType}/${targetId}/`;
    const removed = await deletePrefix(BUCKET, prefix);
    
    // If successful prefix deletion, send a webhook to admin API to clear DB fields
    if (removed.deleted > 0 && removed.errors.length === 0) {
        await sendDeleteWebhook(targetType, targetId);
    }
    
    res.json({ ok: true, message: 'prefix delete attempted', result: removed });
    return
  } catch (err: any) {
    console.error('imagesDelete error', err && err.message ? err.message : err);
    res.status(500).json({ ok: false, message: String(err?.message || err) });
    return
  }
});

export default router;