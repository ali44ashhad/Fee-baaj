import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

type DeleteResult = {
  deleted: number;
  errors: Array<{ Key?: string; Code?: string; Message?: string }>;
};

/**
 * Normalize endpoint string:
 * - If missing scheme, add https://
 * - Strip trailing slash
 * - Return undefined when input is falsy
 */
function normalizeEndpoint(raw?: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = String(raw).trim();
  if (t === "") return undefined;
  // ensure scheme
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return withScheme.replace(/\/$/, "");
}

/**
 * Build S3Client configured from environment.
 * Throws if required config missing.
 */
export function makeS3ClientImage(): S3Client {
  const { S3_KEY, S3_SECRET, S3_REGION, S3_ENDPOINT, S3_FORCE_PATH_STYLE } = process.env;
  if (!S3_KEY || !S3_SECRET || !process.env.S3_BUCKET) {
    throw new Error("Missing S3 config (S3_KEY, S3_SECRET, S3_BUCKET)");
  }
  const endpoint = normalizeEndpoint(S3_ENDPOINT);

  // Keep default behavior conservative: if S3_FORCE_PATH_STYLE explicitly "false" -> false, otherwise true
  const forcePathStyle = (String(S3_FORCE_PATH_STYLE || "").toLowerCase() === "false") ? false : true;

  const client = new S3Client({
    region: S3_REGION || "eu-central-1",
    credentials: { accessKeyId: S3_KEY, secretAccessKey: S3_SECRET },
    forcePathStyle,
    ...(endpoint ? { endpoint } : {}),
  });
  return client;
}

/**
 * List keys under a prefix (handles pagination).
 */
export async function listKeys(s3: S3Client, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let continuation: string | undefined = undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuation,
        MaxKeys: 1000,
      })
    );
    const contents = resp.Contents ?? [];
    for (const c of contents) if (c.Key) out.push(c.Key);
    continuation = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuation);
  return out;
}

/**
 * Delete up to 1000 keys per batch. Returns number deleted and any errors.
 */
export async function deleteKeys(s3: S3Client, bucket: string, keys: string[]): Promise<DeleteResult> {
  if (!keys || keys.length === 0) return { deleted: 0, errors: [] };
  const BATCH = 1000;
  let totalDeleted = 0;
  const errors: DeleteResult["errors"] = [];
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    try {
      const resp = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: slice.map((k) => ({ Key: k })), Quiet: false },
        })
      );
      const deleted = resp.Deleted ?? [];
      totalDeleted += deleted.length;
      const errs = resp.Errors ?? [];
      for (const e of errs) errors.push({ Key: e.Key, Code: e.Code, Message: e.Message });
    } catch (err: any) {
      errors.push({ Message: `Batch delete failed: ${String(err?.message ?? err)}` } as any);
    }
  }
  return { deleted: totalDeleted, errors };
}

/**
 * Upload a Buffer / string to S3 with optional content-type and cache-control.
 */
export async function putObjectBuffer(
  s3: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer | Uint8Array | string,
  contentType?: string,
  cacheControl?: string
): Promise<void> {
  const params: any = { Bucket: bucket, Key: key, Body: buffer };
  if (contentType) params.ContentType = contentType;
  if (cacheControl) params.CacheControl = cacheControl;
  await s3.send(new PutObjectCommand(params));
}

/**
 * Get object as stream + metadata.
 */
export async function getObjectStream(
  s3: S3Client,
  bucket: string,
  key: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = resp.Body as Readable;
  const contentType = resp.ContentType;
  const contentLength = resp.ContentLength ? Number(resp.ContentLength) : undefined;
  return { stream: body, contentType, contentLength };
}

/**
 * Build public URL for a given key.
 *
 * Priority:
 * 1) If S3_CDN_URL present -> return `${S3_CDN_URL}/${key}` (no bucket/account in URL).
 * 2) Otherwise, if S3_ENDPOINT present -> return `${endpoint}/${bucket}/${key}` (path-style).
 * 3) Finally fallback to just the key.
 *
 * Notes:
 * - This function is intended for building browser-accessible URLs (playback/images).
 * - Ensure you set S3_CDN_URL to your public domain (e.g. https://r2.freebaj.com) in env for both server & worker.
 */
export function buildPublicUrlForKey(key: string): string {
  // prefer CDN public url env
  const cdnRaw = process.env.S3_CDN_URL?.trim();
  if (cdnRaw) {
    const base = normalizeEndpoint(cdnRaw) ?? cdnRaw.replace(/\/$/, "");
    return `${base}/${key}`.replace(/([^:]\/)\/+/g, "$1"); // collapse accidental double slashes
  }

  const raw = process.env.S3_ENDPOINT || "";
  const endpoint = normalizeEndpoint(raw) ?? "";
  const bucket = process.env.S3_BUCKET;
  if (endpoint && bucket) {
    return `${endpoint}/${bucket}/${key}`.replace(/([^:]\/)\/+/g, "$1");
  }

  // last-resort: return key (caller should handle)
  return key;
}
