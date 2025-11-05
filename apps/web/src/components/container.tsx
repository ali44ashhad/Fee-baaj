import { cn } from '@/lib/utils';
import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function Container({ children, title, subtitle, className = '' }: ContainerProps) {
  return (
    <main className={cn('max-w-7xl mx-auto px-4 py-8', className)}>
      {title && <h2 className="text-2xl md:text-3xl font-bold mb-2">{title}</h2>}
      {subtitle && <p className="text-gray-600 mb-8">{subtitle}</p>}
      {children}
    </main>
  );
}
