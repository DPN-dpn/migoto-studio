import type { monaco } from '../editor/monaco.ts';
import type { Settings } from '../workspace/settings.ts';

export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;

export type MarkerSeverity = (typeof MarkerSeverity)[keyof typeof MarkerSeverity];

export interface TextModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
  getValue?(): string;
}

export interface LintOptions {
  enabled: boolean;
  duplicateSections: boolean;
  unclosedBlocks: boolean;
  comparisonInCondition: boolean;
  missingResources: boolean;
  undeclaredVars: boolean;
  unusedItems: boolean;
  hasFolder?: boolean;
}

export function optionsFromSettings(s: Settings, hasFolder = false): LintOptions {
  return {
    enabled: s.lintEnabled,
    duplicateSections: s.lintDuplicateSections,
    unclosedBlocks: s.lintUnclosedBlocks,
    comparisonInCondition: s.lintComparisonInCondition,
    missingResources: s.lintMissingResources,
    undeclaredVars: s.lintUndeclaredVars,
    unusedItems: s.lintUnusedItems,
    hasFolder,
  };
}
