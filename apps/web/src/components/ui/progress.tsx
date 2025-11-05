'use client';

import type * as React from 'react';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  className?: string;
}

export function Progress({ value = 0, max = 100, className = '', ...props }: ProgressProps) {
  const percentage = Math.min(Math.max(value, 0), max);

  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`} {...props}>
      <div
        className="h-full w-full flex-1 bg-primary transition-all "
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
}
