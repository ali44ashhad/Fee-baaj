"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFetch = getFetch;
exports.fetcher = fetcher;
async function getFetch() {
    // If native fetch exists (Node 18+ or browser), use it.
    if (typeof globalThis.fetch === 'function') {
        // globalThis.fetch already matches the runtime interface; cast to our signature for TS
        return globalThis.fetch;
    }
    // Dynamic import of node-fetch (ESM). Cast to any/unknown to avoid strict mismatch errors.
    // This runs only when native fetch isn't available.
    const mod = await Promise.resolve().then(() => __importStar(require('node-fetch'))); // use 'any' here to avoid TS structural mismatch
    const fn = mod?.default ?? mod;
    return fn;
}
/**
 * Convenience wrapper that mirrors the fetch API.
 * This is the simplest way to replace direct `import fetch from 'node-fetch'`.
 */
async function fetcher(input, init) {
    const f = await getFetch();
    return f(input, init);
}
