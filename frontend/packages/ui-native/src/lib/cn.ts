import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names (clsx) with Tailwind conflict resolution
 * (tailwind-merge) — 1:1 port of PWA `apps/pwa/src/lib/utils.ts#cn`.
 * Useful with NativeWind `className` props.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
