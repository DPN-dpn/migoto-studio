import type { Platform } from './types';

let current: Platform | null = null;

/**
 * Chooses the platform implementation once at startup.
 * (A `web` implementation will be added here behind `import.meta.env.VITE_TARGET === 'web'`
 * so the web bundle never contains Tauri code.)
 */
export async function initPlatform(): Promise<Platform> {
  current = (await import('./desktop')).desktop;
  return current;
}

export function platform(): Platform {
  if (!current) throw new Error('platform not initialised; call initPlatform() first');
  return current;
}

export type * from './types';
