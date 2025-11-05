import { cn } from '@/lib/utils';
import React, { ReactNode } from 'react';
import Loading from './loading';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, loading, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          /* 'w-full bg-red-600 text-white rounded-full py-4 text-xl font-semibold hover:bg-red-700 transition-colors', */
          ' bg-primary text-white rounded-md py-2 font-medium hover:opacity-80',
          className,
        )}
        disabled={loading}
        {...props}
      >
        {loading ? <Loading /> : children}
      </button>
    );
  },
);

export default Button;
