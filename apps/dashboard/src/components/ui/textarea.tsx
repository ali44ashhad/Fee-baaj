import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from './label';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  full?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, full = false, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        <div className={`grid gap-2 ${full ? 'h-full' : ''}`}>
          <textarea
            className={cn(
              'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              className,
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
