// src/pages/pagination.tsx
import React from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';

type Props = {
  page: number;
  totalPages: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
};

export default function Pagination({
  page,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: Props) {
  const btnBase =
    'flex items-center gap-1 px-3 py-1 border border-black rounded-md shadow-sm bg-white text-black transition transform ';
  const btnHover = 'hover:bg-black hover:text-white ';
  const btnActive = 'active:scale-95 active:translate-y-[1px] ';
  const btnFocus = 'focus:outline-none focus:ring-2 focus:ring-black/30 ';
  const btnDisabled =
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black ';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onFirst}
        disabled={page === 1}
        aria-label="First page"
        aria-disabled={page === 1}
        className={btnBase + btnHover + btnActive + btnFocus + btnDisabled}
      >
        <ChevronsLeft size={16} />
      </button>

      <button
        onClick={onPrev}
        disabled={page === 1}
        aria-label="Previous page"
        aria-disabled={page === 1}
        className={btnBase + btnHover + btnActive + btnFocus + btnDisabled}
      >
        <ChevronLeft size={16} />
      </button>

      <div className="px-3 py-1 border-t border-b border-black rounded-md bg-white">
        <span className="text-sm">
          Page <strong>{page}</strong> / <span>{totalPages}</span>
        </span>
      </div>

      <button
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
        aria-disabled={page >= totalPages}
        className={btnBase + btnHover + btnActive + btnFocus + btnDisabled}
      >
        <ChevronRight size={16} />
      </button>

      <button
        onClick={onLast}
        disabled={page >= totalPages}
        aria-label="Last page"
        aria-disabled={page >= totalPages}
        className={btnBase + btnHover + btnActive + btnFocus + btnDisabled}
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  );
}
