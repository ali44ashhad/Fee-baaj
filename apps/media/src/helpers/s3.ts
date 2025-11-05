// src/helpers/s3.ts
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './s3-config-inti';


const DEFAULT_CACHE_CONTROL = process.env.S3_DEFAULT_CACHE_CONTROL || 'public, max-age=31536000, immutable';
const UPLOAD_CONCURRENCY = Number(process.env.S3_UPLOAD_CONCURRENCY || 6); // tuneable

function contentTypeForPath(fullPath: string) {
  const ext = path.extname(fullPath).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  return (mime.lookup(fullPath) as string) || 'application/octet-stream';
}

/**
 * Recursively upload a directory to S3 under destPrefix (no leading slash).
 * Uses limited concurrency to avoid spiking sockets.
 */
export async function uploadDirToS3(bucket: string, dir: string, destPrefix: string) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(UPLOAD_CONCURRENCY);

  // helper for file upload
  // src/helpers/s3.ts  — update putFile to choose cache per extension
  async function putFile(full: string, key: string) {
    const ContentType = contentTypeForPath(full);
    const ext = path.extname(full).toLowerCase();

    // Set short TTL for playlist files (.m3u8) so CDNs won't serve stale master/variant playlists
    const isPlaylist = ext === '.m3u8';
    const DEFAULT_SEGMENT_CACHE = 'public, max-age=31536000, immutable';
    const PLAYLIST_CACHE = process.env.S3_PLAYLIST_CACHE || 'public, max-age=60, must-revalidate';

    const CacheControl = isPlaylist ? PLAYLIST_CACHE : DEFAULT_SEGMENT_CACHE;

    const Body = fs.createReadStream(full);
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key.replace(/\\/g, '/'),
      Body,
      ContentType,
      CacheControl,
    });

    await s3Client.send(cmd);
  }


  // iterate entries and spawn jobs
  const jobs: Promise<any>[] = [];

  for (const e of entries) {
    const full = path.join(dir, e.name);
    const key = `${destPrefix}/${e.name}`.replace(/\\/g, '/');
    if (e.isDirectory()) {
      jobs.push(limit(() => uploadDirToS3(bucket, full, `${destPrefix}/${e.name}`)));
    } else {
      jobs.push(limit(() => putFile(full, key)));
    }
  }

  await Promise.all(jobs);
}
