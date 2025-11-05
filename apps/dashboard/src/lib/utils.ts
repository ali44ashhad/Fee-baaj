import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const successAlert = (message: string) => toast.success(message, { className: 'bg-primary' });
export const errorAlert = (message: string) =>
  toast.error(message, {
    className: 'bg-red-500',
  });
