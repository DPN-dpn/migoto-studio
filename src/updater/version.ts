export const CURRENT_APP_VERSION = '0.9.1';

/**
 * Compare two semver strings (e.g. '0.1.0' vs '0.1.1').
 * Returns true if latest > current.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const cParts = clean(current).split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = clean(latest).split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(cParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const c = cParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}
