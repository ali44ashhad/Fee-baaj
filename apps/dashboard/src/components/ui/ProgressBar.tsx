// src/components/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  value: number; // 0..100
  height?: number; // px
  showPercent?: boolean;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, height = 8, showPercent = true, label }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      {label && <div className="text-sm text-gray-700 mb-1">{label}</div>}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="w-full bg-gray-200 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 transition-all"
          style={{ width: `${pct}%`, minWidth: pct === 0 ? 0 : undefined }}
        />
      </div>
      {showPercent && (
        <div className="mt-1 text-xs text-gray-600 flex justify-between">
          <span>{pct}%</span>
          <span className="text-xs text-gray-500" />
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
