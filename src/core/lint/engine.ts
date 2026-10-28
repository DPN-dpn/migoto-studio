import type { monaco } from '../editor/monaco.ts';
import type { TextModelLike, LintOptions } from './types.ts';
import {
  stripComments,
  lintQuotes,
  handleSectionHeader,
  handleConditionStatement,
  checkUnclosedBlocks,
  trackLineVariables,
  checkUndeclaredVariables,
  checkUnusedVariables,
  trackLineResources,
  checkMissingResources,
  checkUnusedResources,
  type BlockState,
  type SectionDef,
  type VarDecl,
  type VarUsage,
  type ResourceRef,
} from './rules/index.ts';

/**
 * Lints a Monaco text model according to the configured options.
 * Returns an array of monaco.editor.IMarkerData.
 */
export function lintModel(model: TextModelLike, options: LintOptions): monaco.editor.IMarkerData[] {
  if (!options.enabled) return [];

  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  const sections = new Map<string, SectionDef[]>();
  const declaredVars = new Map<string, VarDecl>();
  const varUsages: VarUsage[] = [];
  const resourceRefs: ResourceRef[] = [];
  const conditionStack: BlockState[] = [];

  let currentSectionName = '';

  for (let line = 1; line <= lineCount; line++) {
    const rawLine = model.getLineContent(line);
    const { code, commentIndex } = stripComments(rawLine);
    const trimmed = code.trim();

    if (trimmed.length === 0) continue;

    // 1. Unclosed quotes check
    lintQuotes(code, line, markers);

    // 2. Section Header check
    const sectionResult = handleSectionHeader(
      code,
      line,
      commentIndex,
      sections,
      conditionStack,
      options,
      markers,
    );
    if (sectionResult.isSection) {
      if (sectionResult.sectionName) {
        currentSectionName = sectionResult.sectionName;
      }
      continue;
    }

    // 3. Condition statements (if, elif, else, endif)
    handleConditionStatement(code, line, conditionStack, options, markers);

    // 4. Variables & Resource references tracking
    const isConstantsSection = currentSectionName.toLowerCase() === 'constants';
    trackLineVariables(code, line, isConstantsSection, declaredVars, varUsages);
    trackLineResources(code, line, resourceRefs);
  }

  // EOF: check unclosed if-blocks
  if (options.unclosedBlocks && conditionStack.length > 0) {
    checkUnclosedBlocks(conditionStack, 'eof', markers);
  }

  // 5. Missing Resources check
  if (options.missingResources) {
    checkMissingResources(resourceRefs, sections, Boolean(options.hasFolder), markers);
  }

  // 6. Undeclared variables check
  if (options.undeclaredVars) {
    checkUndeclaredVariables(varUsages, declaredVars, Boolean(options.hasFolder), markers);
  }

  // 7. Unused items check (info)
  if (options.unusedItems) {
    checkUnusedVariables(declaredVars, varUsages, Boolean(options.hasFolder), markers);
    checkUnusedResources(sections, resourceRefs, Boolean(options.hasFolder), markers);
  }

  return markers;
}
