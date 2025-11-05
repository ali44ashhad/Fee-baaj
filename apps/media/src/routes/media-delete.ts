import { Router, Request, Response } from 'express';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3';
import { ENV } from '../config';

const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function normalizeEndpoint(ep?: string | null): string | undefined {
  if (!ep) return undefined;
  ep = String(ep).trim();
  if (!ep) return undefined;
  if (ep.startsWith('http://') || ep.startsWith('https://')) return ep.replace(/\/$/, '');
  return `https://${ep}`.replace(/\/$/, '');
}

function makeS3Client() {
  const endpoint = normalizeEndpoint(ENV.S3_ENDPOINT);
  const cfg: any = {
    region: ENV.S3_REGION || 'us-east-1',
    credentials: { accessKeyId: ENV.S3_KEY || '', secretAccessKey: ENV.S3_SECRET || '' },
  };
  if (endpoint) {
    cfg.endpoint = endpoint;
    cfg.forcePathStyle = ENV.S3_FORCE_PATH_STYLE === 'false' ? false : true;
  }
  return new S3Client(cfg);
}

const s3 = makeS3Client();
const router = Router();

/**
 * deleteKeysBatch
 * - Deletes up to 1000 keys via DeleteObjects
 * - Returns { deleted: number, errors: Array<{Key?: string, message: string}> }
 */
async function deleteKeysBatch(bucket: string, keys: string[]) {
  if (!keys.length) return { deleted: 0, errors: [] as any[] };

  const input: DeleteObjectsCommandInput = {
    Bucket: bucket,
    Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
  };

  try {
    const resp = await s3.send(new DeleteObjectsCommand(input));
    const deletedCount = (resp.Deleted || []).length;
    const errors = (resp.Errors || []).map((e) => ({ Key: e.Key, message: e.Message || e.Code }));
    if (errors.length) {
      console.warn('deleteKeysBatch: partial failures', { bucket, errors });
    }
    return { deleted: deletedCount, errors };
  } catch (err: any) {
    console.error('deleteKeysBatch: request failed', { bucket, err });
    return { deleted: 0, errors: [{ message: String(err?.message || err) }] };
  }
}

/**
 * deletePrefixStream
 * - Streams ListObjectsV2 pages and deletes objects in-place (no giant in-memory array)
 * - Returns { prefix, attempted, deleted, errors[] }
 */
async function deletePrefixStream(bucket: string, prefix: string) {
  const report = { prefix, attempted: 0, deleted: 0, errors: [] as any[] };

  try {
    let ContinuationToken: string | undefined = undefined;
    // Buffer keys up to 1000 (S3 DeleteObjects limit), flush when reached or at end of page
    let keysBuffer: string[] = [];

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
        if (c.Key) {
          keysBuffer.push(c.Key);
          report.attempted++;
        }
      }

      // If buffer reached 1000 or page is done, flush (delete) it
      if (keysBuffer.length >= 1000 || !resp.IsTruncated) {
        // Delete in chunks of 1000 (safe)
        for (let i = 0; i < keysBuffer.length; i += 1000) {
          const chunk = keysBuffer.slice(i, i + 1000);
          const { deleted, errors } = await deleteKeysBatch(bucket, chunk);
          report.deleted += deleted;
          if (errors?.length) report.errors.push(...errors);
        }
        keysBuffer = [];
      }

      ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (err: any) {
    console.error('deletePrefixStream error for prefix', prefix, err);
    report.errors.push({ message: String(err?.message || err) });
  }

  return report;
}

/**
 * deleteTempMatchesStream
 * - Streams keys under uploads/temp/ and deletes only keys that include courseId (keeps original behavior)
 * - Returns { prefix: 'uploads/temp (matched keys)', attempted, deleted, errors[] }
 */
async function deleteTempMatchesStream(bucket: string, courseId: string) {
  const report = { prefix: 'uploads/temp (matched keys)', attempted: 0, deleted: 0, errors: [] as any[] };

  try {
    const prefix = 'uploads/temp/';
    let ContinuationToken: string | undefined = undefined;
    // collect matched keys in a buffer and delete in batches
    let matchedBuffer: string[] = [];

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
        if (!c.Key) continue;
        // maintain original semantics: match if courseId is included anywhere
        if (String(c.Key).includes(String(courseId))) {
          matchedBuffer.push(c.Key);
          report.attempted++;
        }
      }

      // flush matchedBuffer in chunks of 1000
      if (matchedBuffer.length >= 1000 || !resp.IsTruncated) {
        for (let i = 0; i < matchedBuffer.length; i += 1000) {
          const chunk = matchedBuffer.slice(i, i + 1000);
          const { deleted, errors } = await deleteKeysBatch(bucket, chunk);
          report.deleted += deleted;
          if (errors?.length) report.errors.push(...errors);
        }
        matchedBuffer = [];
      }

      ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (err: any) {
    console.error('deleteTempMatchesStream error', err);
    report.errors.push({ message: String(err?.message || err) });
  }

  return report;
}

router.post(
  '/delete',
  asyncHandler(async (req: Request, res: Response) => {
    // Auth (same behavior as before)
    const auth = (req.headers.authorization || '').trim();
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }
    const token = auth.slice(7);
    if (token !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { type, courseId, lectureId } = req.body || {};
    if (!courseId) return res.status(400).json({ ok: false, message: 'courseId required' });

    const bucket = ENV.S3_BUCKET;
    if (!bucket) return res.status(500).json({ ok: false, message: 'S3_BUCKET not configured' });

    const t = (type || 'course').toString().toLowerCase();
    const results: any[] = [];

    try {
      if (t === 'lecture') {
        if (!lectureId) return res.status(400).json({ ok: false, message: 'lectureId required for type=lecture' });
        const procPrefix = `videos/courses/${courseId}/lectures/${lectureId}/`;
        const rawPrefix = `uploads/videos/courses/${courseId}/lectures/${lectureId}/`;
        results.push(await deletePrefixStream(bucket, procPrefix));
        results.push(await deletePrefixStream(bucket, rawPrefix));
        return res.json({ ok: true, message: 'lecture media delete attempted', results });
      }

      if (t === 'course' || t === 'all') {
        const prefixes = [
          `videos/courses/${courseId}/`,
          `videos/courses/${courseId}/intro/`,
          `uploads/videos/courses/${courseId}/`,
          `uploads/temp/`,
        ];

        for (const p of prefixes) {
          if (p === 'uploads/temp/') {
            const tempResult = await deleteTempMatchesStream(bucket, courseId);
            results.push(tempResult);
            continue;
          }
          results.push(await deletePrefixStream(bucket, p));
        }

        return res.json({ ok: true, message: 'course media delete attempted', results });
      }

      return res.status(400).json({ ok: false, message: 'unknown type - use "course" or "lecture"' });
    } catch (err: any) {
      console.error('media-delete error', err);
      return res.status(500).json({ ok: false, message: String(err?.message || err) });
    }
  })
);

export default router;
