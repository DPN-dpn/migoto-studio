import type { PluginInstance, PluginManifest } from './types.ts';
import { parseGitHubUrl } from './github.ts';

export interface ParsedDependency {
  id: string;
  versionConstraint: string;
  gitHubUrl?: string;
  rawSpec: string;
}

export type DependencyStatusReason =
  | 'ok'
  | 'missing'
  | 'disabled'
  | 'version_mismatch'
  | 'circular';

export interface DependencyCheckResult {
  id: string;
  parsed: ParsedDependency;
  satisfied: boolean;
  status: DependencyStatusReason;
  installedVersion?: string;
  installedPlugin?: PluginInstance;
  message: string;
}

/**
 * Clean and parse semver string into [major, minor, patch, prerelease]
 */
export function parseSemver(v: string): [number, number, number, string | null] {
  const clean = v.trim().replace(/^v/i, '');
  const [core, prerelease] = clean.split('-', 2);
  const parts = core.split('.').map((p) => parseInt(p, 10) || 0);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  return [major, minor, patch, prerelease || null];
}

/**
 * Compare two semver strings: -1 (v1 < v2), 0 (v1 == v2), 1 (v1 > v2)
 */
export function compareSemver(v1: string, v2: string): number {
  const [maj1, min1, pat1] = parseSemver(v1);
  const [maj2, min2, pat2] = parseSemver(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

/**
 * Check if a version satisfies a single constraint condition like '>=1.0.0', '^1.2.0', '~1.0.0', '1.0.0', '*'
 */
export function satisfiesSingleConstraint(version: string, singleConstraint: string): boolean {
  const c = singleConstraint.trim();
  if (!c || c === '*' || c.toLowerCase() === 'latest' || c === 'x') {
    return true;
  }

  // Caret ^1.2.3 (compatible with version: same major version if major > 0; if 0.x.y, same minor)
  if (c.startsWith('^')) {
    const target = c.slice(1).trim();
    const [tMaj, tMin, tPat] = parseSemver(target);
    const [vMaj, vMin, vPat] = parseSemver(version);

    if (tMaj > 0) {
      if (vMaj !== tMaj) return false;
      return compareSemver(version, target) >= 0;
    }
    // 0.x.y: same minor
    if (vMaj !== 0 || vMin !== tMin) return false;
    return vPat >= tPat;
  }

  // Tilde ~1.2.3 (approximate: same major and minor)
  if (c.startsWith('~')) {
    const target = c.slice(1).trim();
    const [tMaj, tMin] = parseSemver(target);
    const [vMaj, vMin] = parseSemver(version);
    if (vMaj !== tMaj || vMin !== tMin) return false;
    return compareSemver(version, target) >= 0;
  }

  // Greater than or equal >=1.0.0
  if (c.startsWith('>=')) {
    return compareSemver(version, c.slice(2).trim()) >= 0;
  }

  // Strictly greater >1.0.0
  if (c.startsWith('>')) {
    return compareSemver(version, c.slice(1).trim()) > 0;
  }

  // Less than or equal <=1.0.0
  if (c.startsWith('<=')) {
    return compareSemver(version, c.slice(2).trim()) <= 0;
  }

  // Strictly less <1.0.0
  if (c.startsWith('<')) {
    return compareSemver(version, c.slice(1).trim()) < 0;
  }

  // Equal =1.0.0
  if (c.startsWith('=')) {
    return compareSemver(version, c.slice(1).trim()) === 0;
  }

  // Exact version match e.g. '1.0.0' or 'v1.0.0'
  return compareSemver(version, c) === 0;
}

/**
 * Check if a version satisfies a compound constraint (e.g. '>=1.0.0 <2.0.0' or '>=1.2.0')
 */
export function satisfiesVersionConstraint(version: string, constraint: string): boolean {
  if (!constraint || constraint === '*' || constraint.toLowerCase() === 'latest') {
    return true;
  }

  // Split by space or comma for compound constraints
  const parts = constraint
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return true;
  return parts.every((single) => satisfiesSingleConstraint(version, single));
}

/**
 * Parse dependency specification string.
 * Examples:
 * - ">=1.0.0" -> version constraint
 * - "https://github.com/owner/repo" -> GitHub URL
 * - "owner/repo" -> GitHub URL
 * - "https://github.com/owner/repo#>=1.0.0" -> GitHub URL + version constraint
 * - ">=1.0.0 https://github.com/owner/repo" -> version constraint + GitHub URL
 */
export function parseDependencySpec(depId: string, rawSpec: string): ParsedDependency {
  const spec = (rawSpec || '').trim();
  if (!spec) {
    return { id: depId, versionConstraint: '*', rawSpec };
  }

  let versionConstraint = '*';
  let gitHubUrl: string | undefined;

  // 1. Check for URL with hash e.g. "https://github.com/owner/repo#>=1.0.0"
  if (spec.includes('#')) {
    const [urlPart, hashPart] = spec.split('#', 2);
    if (parseGitHubUrl(urlPart)) {
      gitHubUrl = urlPart.trim();
      versionConstraint = hashPart.trim() || '*';
      return { id: depId, versionConstraint, gitHubUrl, rawSpec };
    }
  }

  // 2. Check for combined format e.g. ">=1.0.0 @ https://github.com/owner/repo" or ">=1.0.0 https://github.com/owner/repo"
  const tokens = spec.split(/\s+/);
  if (tokens.length >= 2) {
    for (const token of tokens) {
      if (token === '@') continue;
      if (parseGitHubUrl(token)) {
        gitHubUrl = token;
      } else if (!token.startsWith('http')) {
        versionConstraint = token;
      }
    }
    if (gitHubUrl) {
      return { id: depId, versionConstraint, gitHubUrl, rawSpec };
    }
  }

  // 3. Single token: GitHub URL or version constraint?
  if (parseGitHubUrl(spec)) {
    gitHubUrl = spec;
    versionConstraint = '*';
  } else {
    versionConstraint = spec;
  }

  return { id: depId, versionConstraint, gitHubUrl, rawSpec };
}

/**
 * Check a single dependency requirement against currently installed/registered plugins
 */
export function checkDependency(
  dep: ParsedDependency,
  getPlugin: (id: string) => PluginInstance | undefined,
): DependencyCheckResult {
  const targetPlugin = getPlugin(dep.id);

  if (!targetPlugin) {
    const reqStr = dep.versionConstraint && dep.versionConstraint !== '*'
      ? ` (${dep.versionConstraint})`
      : '';
    return {
      id: dep.id,
      parsed: dep,
      satisfied: false,
      status: 'missing',
      message: `플러그인이 설치되어 있지 않습니다${reqStr}`,
    };
  }

  if (!targetPlugin.enabled) {
    return {
      id: dep.id,
      parsed: dep,
      satisfied: false,
      status: 'disabled',
      installedVersion: targetPlugin.manifest.version,
      installedPlugin: targetPlugin,
      message: `플러그인이 비활성화되어 있습니다`,
    };
  }

  const installedVer = targetPlugin.manifest.version || '0.0.0';
  if (!satisfiesVersionConstraint(installedVer, dep.versionConstraint)) {
    return {
      id: dep.id,
      parsed: dep,
      satisfied: false,
      status: 'version_mismatch',
      installedVersion: installedVer,
      installedPlugin: targetPlugin,
      message: `버전 불일치 (현재: v${installedVer}, 요구: ${dep.versionConstraint})`,
    };
  }

  return {
    id: dep.id,
    parsed: dep,
    satisfied: true,
    status: 'ok',
    installedVersion: installedVer,
    installedPlugin: targetPlugin,
    message: `정상 (v${installedVer})`,
  };
}

/**
 * Check all dependencies declared in a plugin manifest
 */
export function checkAllDependencies(
  manifest: PluginManifest,
  getPlugin: (id: string) => PluginInstance | undefined,
): DependencyCheckResult[] {
  const deps = manifest.dependencies;
  if (!deps || typeof deps !== 'object') return [];

  const results: DependencyCheckResult[] = [];
  for (const [depId, spec] of Object.entries(deps)) {
    const parsed = parseDependencySpec(depId, String(spec));
    results.push(checkDependency(parsed, getPlugin));
  }
  return results;
}

/**
 * Topologically sort plugins based on their manifest.dependencies so dependencies activate first.
 * Gracefully handles and detects circular dependencies.
 */
export function topologicalSortPlugins(plugins: PluginInstance[]): {
  sorted: PluginInstance[];
  cycles: string[][];
} {
  const pluginMap = new Map<string, PluginInstance>();
  for (const p of plugins) {
    pluginMap.set(p.manifest.id, p);
  }

  const sorted: PluginInstance[] = [];
  const cycles: string[][] = [];

  // Status for cycle detection: 0 = unvisited, 1 = visiting, 2 = visited
  const visitState = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  function visit(id: string) {
    const state = visitState.get(id) || 0;
    if (state === 2) return; // Already finished
    if (state === 1) {
      // Cycle detected
      const cycleStart = stack.indexOf(id);
      if (cycleStart !== -1) {
        const cycle = stack.slice(cycleStart).concat(id);
        cycles.push(cycle);
        console.warn(`[plugins] Circular dependency detected: ${cycle.join(' -> ')}`);
      }
      return;
    }

    visitState.set(id, 1);
    stack.push(id);

    const plugin = pluginMap.get(id);
    if (plugin && plugin.manifest.dependencies) {
      for (const depId of Object.keys(plugin.manifest.dependencies)) {
        if (pluginMap.has(depId)) {
          visit(depId);
        }
      }
    }

    stack.pop();
    visitState.set(id, 2);
    if (plugin && !sorted.some((p) => p.manifest.id === id)) {
      sorted.push(plugin);
    }
  }

  for (const p of plugins) {
    if ((visitState.get(p.manifest.id) || 0) === 0) {
      visit(p.manifest.id);
    }
  }

  return { sorted, cycles };
}
