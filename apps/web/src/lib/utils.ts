import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'react-toastify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const successAlert = (message: string) => toast.success(message);

export const errorAlert = (message: string) => {
  toast.dismiss();
  toast.error(message);
};

export const formatNumber = (num: number) => num.toString().padStart(2, '0');

/* export const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    const value = num / 1_000_000;
    return (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)) + ' million';
  } else if (num >= 1_000) {
    const value = num / 1_000;
    return (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)) + 'K';
  }
  return num.toString();
}; */

/* export const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(0)}sec`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) return remainingSeconds ? `${minutes}min ${remainingSeconds.toFixed(0)}sec` : `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
};
 */