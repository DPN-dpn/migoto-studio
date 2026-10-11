import type { Platform } from './types';

let current: Platform | null = null;

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Chooses the platform implementation once at startup.
 * If running inside Tauri (desktop), dynamically loads `desktop.ts`.
 * If running in a standard web browser (e.g. GitHub Pages), dynamically loads `web.ts`.
 */
export async function initPlatform(): Promise<Platform> {
  if (isTauriEnvironment()) {
    current = (await import('./desktop')).desktop;
  } else {
    current = (await import('./web')).web;
  }
  return current;
}

export function platform(): Platform {
  if (!current) throw new Error('platform not initialised; call initPlatform() first');
  return current;
}

export type * from './types';
