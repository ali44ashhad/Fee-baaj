import { cn } from '@/lib/utils';
import * as React from 'react'; // Instead of default import

interface LoadingProps extends React.SVGProps<SVGSVGElement> {
    full?: boolean;
    className?: string;
}

const Loading = ({ className = '', full = false, ...props }: LoadingProps) => {
    if (full) {
        return (
            <div className="flex h-screen items-center justify-center bg-white text-primary">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn('animate-spin inline-block', className)}
                    {...props}
                >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            </div>
        );
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('animate-spin inline-block', className)}
            {...props}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
};

export default Loading;
