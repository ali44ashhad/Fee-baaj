// src/pages/api.ts
import apiClient from '../../lib/apiClient'; // keep your existing apiclient
// Note: the fallback uses the browser fetch to retrieve the raw JSON if apiClient returns undefined.

export type ParticipantModel = 'User' | 'Instructor';

const urlApi =import.meta.env.VITE_API_BASE_URL

export interface ReportDTO {
  _id: string;
  messageId: string;
  reporter: { id: string; model: ParticipantModel };
  reason: string;
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string | null;
  resolvedBy?: { id: string; model: ParticipantModel } | null;
}

export interface PaginatedReports {
  success: boolean;
  meta: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
  data: ReportDTO[];
}

/**
 * Normalizes several possible backend/client response shapes into PaginatedReports.
 */
function normalizeResponse(payload: any, page = 1, limit = 10): PaginatedReports {
  // If payload already matches the PaginatedReports shape
  if (payload && typeof payload === 'object' && Array.isArray(payload.data) && payload.meta) {
    return payload as PaginatedReports;
  }

  // Some clients/servers use `results` as the wrapper
  if (payload && typeof payload === 'object' && Array.isArray(payload.results) && payload.meta) {
    return {
      success: true,
      meta: payload.meta,
      data: payload.results,
    } as PaginatedReports;
  }

  // If payload is an array => wrap it
  if (Array.isArray(payload)) {
    const arr = payload as ReportDTO[];
    return {
      success: true,
      meta: {
        total: arr.length,
        totalPages: 1,
        page,
        limit,
      },
      data: arr,
    };
  }

  // If payload has `results` as an array and no meta
  if (payload && typeof payload === 'object' && Array.isArray(payload.results)) {
    const arr = payload.results as ReportDTO[];
    return {
      success: true,
      meta: {
        total: arr.length,
        totalPages: 1,
        page,
        limit,
      },
      data: arr,
    };
  }

  // fallback: empty
  return {
    success: false,
    meta: { total: 0, totalPages: 1, page, limit },
    data: [],
  };
}

/**
 * fetchReports - tries apiClient first, falls back to window.fetch if needed.
 *
 * Notes:
 * - Uses the same relative path you had in your file: '/reports/messages'
 * - Keeps using your apiClient so interceptors/auth/baseURL are respected.
 */
export async function fetchReports(opts: {
  page?: number;
  limit?: number;
  resolved?: boolean | undefined;
}): Promise<PaginatedReports> {
  const { page = 1, limit = 10, resolved } = opts || {};
  const params: Record<string, any> = { page, limit };
  if (resolved !== undefined) params.resolved = resolved;

  // Try using your apiClient first (keeps auth, interceptors, baseURL)
  try {
    // apiClient signature: apiClient<T>(url, method, data?, params?)
    const clientResult = await apiClient<any>(`/reports/messages`, 'GET', undefined, params);

    // clientResult could be:
    // - a PaginatedReports object { success, meta, data }
    // - a raw array
    // - undefined (if apiClient unwrapped wrong property)
    if (clientResult !== undefined) {
      return normalizeResponse(clientResult, page, limit);
    }
    // if undefined, fall through to fetch fallback
  } catch (err) {
    // if apiClient fails (network/auth), we still try fetch fallback below
    // but don't mask errors — we will fallback and, if that fails, rethrow
    // console.warn('apiClient fetchReports error, falling back to fetch', err);
  }

  // Fallback: use fetch directly to get the raw JSON (relative path)
  try {
    // Build query string
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const resp = await fetch(`${urlApi}/reports/messages?${qs}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to fetch reports: ${resp.status} ${text}`);
    }

    const json = await resp.json();
    return normalizeResponse(json, page, limit);
  } catch (err) {
    // rethrow so callers see the error
    throw err;
  }
}
