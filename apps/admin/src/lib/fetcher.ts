// src/lib/fetcher.ts
/**
 * Safe fetch helper for mixed environments (Node 18+ native fetch, or node-fetch v3 fallback).
 *
 * Usage:
 *   import { fetcher } from '@/lib/fetcher';
 *   const res = await fetcher(url, opts);
 *
 * This avoids static `import fetch from 'node-fetch'` which fails in CommonJS contexts
 * because node-fetch@3 is ESM-only. We dynamically import node-fetch only when native
 * fetch is not available.
 */

export type FetchFn = (input: RequestInfo | URL | string, init?: RequestInit) => Promise<Response>;

export async function getFetch(): Promise<FetchFn> {
  // If native fetch exists (Node 18+ or browser), use it.
  if (typeof globalThis.fetch === 'function') {
    // globalThis.fetch already matches the runtime interface; cast to our signature for TS
    return globalThis.fetch as unknown as FetchFn;
  }

  // Dynamic import of node-fetch (ESM). Cast to any/unknown to avoid strict mismatch errors.
  // This runs only when native fetch isn't available.
  const mod: any = await import('node-fetch'); // use 'any' here to avoid TS structural mismatch
  const fn: any = mod?.default ?? mod;
  return fn as FetchFn;
}

/**
 * Convenience wrapper that mirrors the fetch API.
 * This is the simplest way to replace direct `import fetch from 'node-fetch'`.
 */
export async function fetcher(input: RequestInfo | URL | string, init?: RequestInit): Promise<Response> {
  const f = await getFetch();
  return f(input as any, init as any);
}
