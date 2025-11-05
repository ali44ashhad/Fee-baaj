// src/pages/ReportsPage.tsx
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchReports, PaginatedReports, ReportDTO } from './api';
import Pagination from './pagination';
import { Loader2, X } from 'lucide-react';

export default function ReportsPage(): JSX.Element {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'true' | 'false'>('all');

  // modal state for showing full reason
  const [selectedReport, setSelectedReport] = useState<ReportDTO | null>(null);

  // Convert the select value into the boolean | undefined we send to the API
  const resolvedQuery = resolvedFilter === 'all' ? undefined : resolvedFilter === 'true';

  // --- Build query options object and cast it to avoid overload typing issues ---
  const queryOptions = {
    queryKey: ['reports', { page, limit, resolved: resolvedQuery }],
    queryFn: () => fetchReports({ page, limit, resolved: resolvedQuery }),
    // keepPreviousData is the desired behavior; TS overloads sometimes don't accept it in some signatures,
    // so we cast the options object when passing to useQuery (safe and localized).
    keepPreviousData: true,
    staleTime: 30_000,
  } as any;

  // Use three generics: TQueryFnData, TError, TData so `data` is typed as PaginatedReports.
  const { data, isLoading, isError, error, isFetching } = useQuery<
    PaginatedReports, // TQueryFnData (what queryFn returns)
    Error,            // TError
    PaginatedReports  // TData (what `data` will be typed as)
  >(queryOptions as any);

  const reports = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? 0;

  function goFirst() {
    setPage(1);
  }
  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }
  function goLast() {
    setPage(totalPages);
  }

  // close modal on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedReport(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // lock body scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    if (selectedReport) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original || '';
    }
    return () => {
      document.body.style.overflow = original || '';
    };
  }, [selectedReport]);

  return (
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-semibold">Reported Messages</h1>

          <div className="flex items-center gap-3">
            <label className="text-sm">Rows</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-black px-2 py-1 rounded-md"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <label className="text-sm">Resolved</label>
            <select
              value={resolvedFilter}
              onChange={(e) => {
                setResolvedFilter(e.target.value as any);
                setPage(1);
              }}
              className="border border-black px-2 py-1 rounded-md"
            >
              <option value="all">All</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table container: horizontal scroll allowed if table is too wide */}
        <div className="overflow-x-auto border border-black rounded-md shadow-sm">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-black text-white">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Message ID</th>
                <th className="px-4 py-3 text-left">Reporter</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Resolved</th>
                <th className="px-4 py-3 text-left">Resolved At</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-red-600">
                    {error?.message ?? 'Failed to load reports'}
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">No reports found</td>
                </tr>
              ) : (
                reports.map((r, idx) => (
                  <tr
                    key={r._id}
                    className={`${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-gray-100 transition-colors`}
                  >
                    <td className="px-4 py-3 align-top">{(page - 1) * limit + idx + 1}</td>
                    <td className="px-4 py-3 align-top break-words max-w-xs">{r.messageId}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm break-words max-w-xs">{r.reporter.id}</div>
                      <div className="text-xs opacity-70">{r.reporter.model}</div>
                    </td>

                    {/* Reason column: clickable, truncated, shows modal on click */}
                    <td
                      className="px-4 py-3 align-top max-w-[240px] min-w-[120px]"
                      title={r.reason}
                    >
                      <div
                        className="truncate text-sm cursor-pointer hover:underline hover:text-black/80"
                        onClick={() => setSelectedReport(r)}
                        role="button"
                        aria-label={`View full reason for report ${r._id}`}
                      >
                        {r.reason}
                      </div>
                      <div className="text-xs opacity-60 mt-1">Click to view full reason</div>
                    </td>

                    <td className="px-4 py-3 align-top">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 align-top">{r.resolved ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 align-top">
                      {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              onFirst={goFirst}
              onPrev={goPrev}
              onNext={goNext}
              onLast={goLast}
            />
            {isFetching && !isLoading ? <div className="text-xs italic opacity-70">Updating...</div> : null}
          </div>

          <div className="text-sm">
            Showing <strong>{reports.length}</strong> of <strong>{total}</strong>
          </div>
        </div>
      </div>

      {/* Modal — shows full reason: panel scrolls vertically only */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-reason-title"
        >
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
          />

          {/* panel: responsive width, limited height, internal vertical scrolling only */}
          <div className="relative z-10 w-full max-w-3xl mx-auto px-2">
            {/* outer panel prevents horizontal overflow */}
            <div className="bg-white text-black rounded-lg shadow-2xl border border-black/10 overflow-hidden">
              {/* header */}
              <div className="flex items-start justify-between gap-4 p-4 border-b border-black/5">
                <div>
                  <h2 id="report-reason-title" className="text-lg font-semibold">
                    Report reason
                  </h2>
                  <p className="text-xs opacity-70 mt-1">Message ID: {selectedReport.messageId}</p>
                </div>

                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2 rounded-md hover:bg-black hover:text-white transition transform active:scale-95 focus:outline-none"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* scrollable content area: vertical only + no horizontal scroll */}
              <div
                className="p-4 max-h-[75vh] sm:max-h-[70vh] md:max-h-[75vh] overflow-y-auto overflow-x-hidden"
                aria-describedby="report-reason-content"
              >
                <div
                  id="report-reason-content"
                  className="whitespace-pre-wrap text-sm leading-relaxed break-words"
                >
                  {selectedReport.reason}
                </div>

                {/* metadata & actions */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-xs opacity-60">
                    Report ID: <span className="font-mono">{selectedReport._id}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedReport.reason).catch(() => {});
                      }}
                      className="px-3 py-1 border border-black rounded-md bg-white hover:bg-black hover:text-white transition active:scale-95 text-sm"
                    >
                      Copy reason
                    </button>

                    <button
                      onClick={() => setSelectedReport(null)}
                      className="px-3 py-1 border border-black rounded-md bg-white hover:bg-black hover:text-white transition active:scale-95 text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
