import {
  isBuiltinResource,
  isHelpIniResource,
  isHelpIniVariable,
} from './builtin-syntax/index.ts';

export type PatternMatcher = string | RegExp | ((name: string) => boolean);

let registeredAllowedResources: PatternMatcher[] = [];
let registeredAllowedVariables: PatternMatcher[] = [];
let registeredAllowedUsedVariables: PatternMatcher[] = [];
let registeredAllowedUsedResources: PatternMatcher[] = [];

// --- Allowed Resources ---

export function registerAllowedResource(pattern: PatternMatcher): () => void {
  registeredAllowedResources.push(pattern);
  return () => {
    registeredAllowedResources = registeredAllowedResources.filter((p) => p !== pattern);
  };
}

export function isAllowedResource(name: string): boolean {
  if (isBuiltinResource(name) || isHelpIniResource(name)) return true;
  const norm = name.toLowerCase();
  return registeredAllowedResources.some((p) => {
    if (typeof p === 'function') return p(name) || p(norm);
    if (typeof p === 'string') return p.toLowerCase() === norm;
    return p.test(name);
  });
}

export function clearAllowedResources(): void {
  registeredAllowedResources = [];
  registeredAllowedUsedResources = [];
}

// --- Allowed Variables ---

export function registerAllowedVariable(pattern: PatternMatcher): () => void {
  registeredAllowedVariables.push(pattern);
  return () => {
    registeredAllowedVariables = registeredAllowedVariables.filter((p) => p !== pattern);
  };
}

export function isAllowedVariable(name: string): boolean {
  if (isHelpIniVariable(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedVariables.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedVariables(): void {
  registeredAllowedVariables = [];
  registeredAllowedUsedVariables = [];
}

// --- Allowed Used Variables ---

export function registerAllowedUsedVariable(pattern: PatternMatcher): () => void {
  registeredAllowedUsedVariables.push(pattern);
  return () => {
    registeredAllowedUsedVariables = registeredAllowedUsedVariables.filter((p) => p !== pattern);
  };
}

export function isAllowedUsedVariable(name: string): boolean {
  if (isHelpIniVariable(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedUsedVariables.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedUsedVariables(): void {
  registeredAllowedUsedVariables = [];
}

// --- Allowed Used Resources ---

export function registerAllowedUsedResource(pattern: PatternMatcher): () => void {
  registeredAllowedUsedResources.push(pattern);
  return () => {
    registeredAllowedUsedResources = registeredAllowedUsedResources.filter((p) => p !== pattern);
  };
}

export function isAllowedUsedResource(name: string): boolean {
  if (isBuiltinResource(name) || isHelpIniResource(name)) return true;
  const norm = name.toLowerCase();
  const trimmed = norm.startsWith('\\') ? norm.slice(1) : norm;
  return registeredAllowedUsedResources.some((p) => {
    if (typeof p === 'function') {
      return p(name) || p(norm) || p(trimmed) || p(`\\${trimmed}`);
    }
    if (typeof p === 'string') {
      const pNorm = p.toLowerCase();
      const pTrimmed = pNorm.startsWith('\\') ? pNorm.slice(1) : pNorm;
      return norm === pNorm || trimmed === pTrimmed;
    }
    return p.test(name) || p.test(norm) || p.test(trimmed) || p.test(`\\${trimmed}`);
  });
}

export function clearAllowedUsedResources(): void {
  registeredAllowedUsedResources = [];
}
