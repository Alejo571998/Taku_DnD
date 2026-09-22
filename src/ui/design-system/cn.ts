import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases resolviendo conflictos de Tailwind (la ultima gana). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
