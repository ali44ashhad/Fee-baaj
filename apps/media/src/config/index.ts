// src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

const MB = 1024 * 1024;

export const ENV = {
  PORT: Number(process.env.PORT || 3006),
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
  TMP_UPLOAD_DIR: process.env.TMP_UPLOAD_DIR || '/tmp/uploads',
  HLS_TMP_ROOT: process.env.HLS_TMP_ROOT || '/tmp/hls',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_KEY: process.env.S3_KEY || '',
  S3_SECRET: process.env.S3_SECRET || '',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_CDN_URL: process.env.S3_CDN_URL,
  S3_REGION: process.env.S3_REGION,
  MAX_PROXY_PART_SIZE: process.env.MAX_PROXY_PART_SIZE,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  HLS_HOT_DIR: process.env.HLS_HOT_DIR || '/tmp/hot',
  
  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY || 1),
  MEDIA_PUBLIC_URL:process.env.MEDIA_PUBLIC_URL,
  // threshold (bytes) for client/server to choose direct-to-s3. Default = 200MB
  DIRECT_UPLOAD_THRESHOLD_BYTES: (Number(process.env.DIRECT_UPLOAD_THRESHOLD_BYTES) || 200) * MB,
};
