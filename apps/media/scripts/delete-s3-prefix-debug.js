#!/usr/bin/env node
/**
 * delete-s3-prefix-debug.js
 *
 * Verbose/debugging version:
 * - searches parent directories for .env and loads it
 * - prints which .env loaded
 * - prints S3 client options (no secrets)
 * - lists first page of objects for prefix to confirm listing works
 * - deletes all objects under prefix if any found
 *
 * WARNING: This WILL DELETE everything under the prefix if objects are found.
 *
 * Usage:
 *   node delete-s3-prefix-debug.js --prefix "videos/af487edc-3e33-4d98-be4c-fbec4cec39a2/"
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const dotenv = require('dotenv');

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

function findDotEnv(maxUp = 6) {
  let dir = process.cwd();
  for (let i = 0; i <= maxUp; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadEnv() {
  const found = findDotEnv();
  if (found) {
    const res = dotenv.config({ path: found });
    if (res.error) {
      console.warn('dotenv failed to load .env at', found, res.error);
    } else {
      console.log('Loaded .env from:', found);
    }
    return found;
  } else {
    console.warn('No .env file found up to parent levels. Using process.env as-is.');
    return null;
  }
}

function parsePrefixArg() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--prefix' || a === '-p') return args[i + 1];
    if (a.startsWith('--prefix=')) return a.split('=', 2)[1];
  }
  return undefined;
}

async function listFirstPage(s3, bucket, prefix) {
  const resp = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 20,
    })
  );
  return resp;
}

async function listAllKeys(s3, bucket, prefix) {
  const keys = [];
  let continuationToken = undefined;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );
    const contents = resp.Contents || [];
    for (const c of contents) if (c.Key) keys.push({ Key: c.Key, Size: c.Size });
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function deleteKeysInBatches(s3, bucket, keys) {
  const BATCH = 1000;
  let deletedTotal = 0;
  const errors = [];
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    const delReq = {
      Bucket: bucket,
      Delete: { Objects: batch.map((k) => ({ Key: k.Key })), Quiet: false },
    };
    try {
      const resp = await s3.send(new DeleteObjectsCommand(delReq));
      const deleted = resp.Deleted || [];
      deletedTotal += deleted.length;
      const errs = resp.Errors || [];
      for (const e of errs) errors.push(e);
      console.log(
        `Batch ${Math.floor(i / BATCH) + 1}: requested ${batch.length}, deleted ${deleted.length}, errors ${errs.length}`
      );
    } catch (err) {
      console.error(
        `DeleteObjects error in batch ${Math.floor(i / BATCH) + 1}:`,
        err && err.message ? err.message : err
      );
      errors.push({ Message: String(err && err.message ? err.message : err) });
    }
  }
  return { deletedTotal, errors };
}

(async function main() {
  loadEnv();

  const prefix = parsePrefixArg();
  if (!prefix) {
    console.error('Error: --prefix is required. Example: --prefix "videos/xxx/"');
    process.exit(3);
  }
  const normalizedPrefix = prefix;

  const {
    S3_ENDPOINT: rawEndpoint,
    S3_KEY,
    S3_SECRET,
    S3_BUCKET,
    S3_REGION,
    S3_FORCE_PATH_STYLE,
  } = process.env;

  console.log('--- ENV SUMMARY (sensitive values hidden) ---');
  console.log('S3_ENDPOINT:', rawEndpoint || '<unset>');
  console.log('S3_BUCKET:', S3_BUCKET || '<unset>');
  console.log('S3_REGION:', S3_REGION || '<unset>');
  console.log('S3_FORCE_PATH_STYLE:', S3_FORCE_PATH_STYLE || '<unset>');
  console.log('--------------------------------------------');

  if (!S3_KEY || !S3_SECRET || !S3_BUCKET) {
    console.error(
      'Missing S3 configuration. Ensure S3_KEY, S3_SECRET and S3_BUCKET are set (in .env or environment).'
    );
    process.exit(2);
  }

  const forcePathStyle = (S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true';

  // ensure endpoint includes protocol (avoid Invalid URL)
  let endpoint;
  if (rawEndpoint) {
    endpoint = rawEndpoint;
    if (!/^https?:\/\//i.test(endpoint)) endpoint = 'https://' + endpoint;
  }

  const clientOpts = {
    region: S3_REGION || 'eu-central-1',
    credentials: {
      accessKeyId: S3_KEY,
      secretAccessKey: S3_SECRET,
    },
    forcePathStyle,
  };
  if (endpoint) clientOpts.endpoint = endpoint;

  console.log('Creating S3 client with options (secrets hidden).');
  if (endpoint) console.log('Using S3 endpoint:', endpoint);

  const s3 = new S3Client(clientOpts);

  // Quick test: list first page so we can see if listing works and prefix matches
  console.log(`Checking objects for prefix "${normalizedPrefix}" (first 20 items) ...`);
  try {
    const page = await listFirstPage(s3, S3_BUCKET, normalizedPrefix);
    const sample = page.Contents || [];
    console.log(`List response: IsTruncated=${page.IsTruncated}, FoundInPage=${sample.length}`);
    if (sample.length > 0) {
      console.log('Sample keys:');
      for (let i = 0; i < Math.min(10, sample.length); i++) {
        console.log(` - ${sample[i].Key} (${sample[i].Size ?? '?'} bytes)`);
      }
    } else {
      console.log(
        'No keys in first page. This could mean: prefix not matched, wrong bucket, wrong endpoint/region, or no objects exist.'
      );
      console.log('Double-check:');
      console.log(' - is the prefix EXACT (case-sensitive)?');
      console.log(' - try running the script with a shorter prefix or root (e.g. --prefix "videos/") to see if you get listings.');
      // continue to full list attempt
    }
  } catch (err) {
    console.error('Error while listing objects (first page). This usually means network/auth/endpoint problem:');
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }

  // Now list all keys
  console.log('Listing all objects under prefix (may take time)...');
  let keys;
  try {
    keys = await listAllKeys(s3, S3_BUCKET, normalizedPrefix);
  } catch (err) {
    console.error('Failed to list all objects:', err && err.message ? err.message : err);
    process.exit(1);
  }

  if (!keys || keys.length === 0) {
    console.log('No objects found for that prefix. Nothing to delete. Exiting.');
    process.exit(0);
  }

  console.log(`Total objects found: ${keys.length}. Proceeding to delete...`);
  try {
    const { deletedTotal, errors } = await deleteKeysInBatches(s3, S3_BUCKET, keys);
    console.log('Deletion complete.');
    console.log(`Deleted: ${deletedTotal}/${keys.length}`);
    if (errors.length > 0) {
      console.error(`There were ${errors.length} errors. First few:`, errors.slice(0, 5));
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during deletion:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();

// example to run the script

// node delete-s3-prefix-debug.js --prefix "videos/job-1760020793135/"
