// src/helpers/s3-client.ts
import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import http from 'http';
import https from 'https';
import { ENV } from '../config';

function normalizeEndpointRaw(ep?: string | null): string | undefined {
  if (!ep) return undefined;
  let e = String(ep).trim();
  if (!e) return undefined;
  // add https when user provided hostname only
  if (!e.startsWith('http://') && !e.startsWith('https://')) e = `https://${e}`;
  try {
    const u = new URL(e);
    return u.toString().replace(/\/$/, '');
  } catch {
    return e;
  }
}

/**
 * For some providers (R2) users may supply an endpoint that includes the bucket name
 * (e.g. "<bucket>.account.r2.cloudflarestorage.com"). If you supply S3_BUCKET via ENV,
 * strip the bucket prefix from hostname so TLS cert matches.
 */
function normalizeEndpoint(ep?: string | null): string | undefined {
  const raw = normalizeEndpointRaw(ep);
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const bucket = String(process.env.S3_BUCKET || '').trim();
    if (bucket && u.hostname.startsWith(`${bucket}.`)) {
      u.hostname = u.hostname.replace(`${bucket}.`, '');
      return u.toString().replace(/\/$/, '');
    }
    return raw;
  } catch {
    return raw;
  }
}

const endpoint = normalizeEndpoint(ENV.S3_ENDPOINT);
const isHttps = !!endpoint && endpoint.startsWith('https://');

// HTTP agent settings (keep alive + max sockets) — tune via ENV
const MAX_SOCKETS = Number(process.env.S3_MAX_SOCKETS || 128);
const AGENT_KEEPALIVE = true;
const connectionTimeoutMs = Number(process.env.S3_CONN_TIMEOUT_MS || 30_000);

const httpAgent = new http.Agent({ keepAlive: AGENT_KEEPALIVE, maxSockets: MAX_SOCKETS });
const httpsAgent = new https.Agent({ keepAlive: AGENT_KEEPALIVE, maxSockets: MAX_SOCKETS });

// Build NodeHttpHandler to pass the agents to AWS SDK v3
const requestHandler = new NodeHttpHandler({
  httpAgent,
  httpsAgent,
  connectionTimeout: connectionTimeoutMs,
});

export const s3Client = new S3Client({
  region: ENV.S3_REGION || 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: ENV.S3_KEY || '',
    secretAccessKey: ENV.S3_SECRET || '',
  },
  forcePathStyle: (String(ENV.S3_FORCE_PATH_STYLE || 'false') === 'true'),
  requestHandler,
  // you can add retryStrategy or other options here if needed
});

export default s3Client;
