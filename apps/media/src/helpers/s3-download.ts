// src/helpers/s3-download.ts
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { s3Client } from './s3-config-inti';


export async function downloadFromS3(bucket: string, key: string, destPath: string) {
  try {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const res = await s3Client.send(cmd);
    const body = res.Body as any;
    if (!body) throw new Error('No body in S3 getObject response');
    await pipeline(body, fs.createWriteStream(destPath));
    return destPath;
  } catch (err) {
    (err as any).message = `downloadFromS3 failed for bucket=${bucket} key=${key}: ${(err as any).message || err}`;
    throw err;
  }
}
