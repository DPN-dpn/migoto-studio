import type { monaco } from '../../editor/monaco.ts';
import { MarkerSeverity } from '../types.ts';
import type { SectionDef } from './sections.ts';
import { isAllowedResource, isAllowedUsedResource } from '../registry.ts';

export interface ResourceRef {
  name: string;
  line: number;
  col: number;
  endCol: number;
}

/**
 * Tracks resource and command list references on a single line.
 */
export function trackLineResources(
  code: string,
  line: number,
  resourceRefs: ResourceRef[],
): void {
  // Keys like: run = CommandListX, post run = ..., pre run = ..., this = ResourceX, vb0 = ResourceX, ib = ResourceIB, ps-t0 = ResourceTexture
  // or path/namespace references: Resource\Sub\Key = ref Target, run = CommandList\Sub\Action
  const resRefMatch = /^\s*(?:(?:pre\s+|post\s+)?run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+|Resource(?:\\[a-zA-Z0-9_.\-]+)*)\s*=\s*(?:ref\s+|copy\s+)?([a-zA-Z0-9_.\-\\\/]+)/i.exec(code);
  if (resRefMatch) {
    const target = resRefMatch[1].trim();
    const lowerTarget = target.toLowerCase();
    // Skip keywords like 'null', 'skip', 'auto', 'default'
    if (!['null', 'skip', 'auto', 'default'].includes(lowerTarget)) {
      if (
        /^(?:resource|commandlist|customshader)/i.test(target) ||
        /(?:run|this|vb\d+|ib|[a-z]{2}-(?:[tu]|cb)\d+)\s*=/i.test(code)
      ) {
        const eqIdx = code.indexOf('=');
        const valIdx = eqIdx !== -1 ? code.indexOf(target, eqIdx) : code.lastIndexOf(target);
        if (valIdx !== -1) {
          resourceRefs.push({
            name: target,
            line,
            col: valIdx + 1,
            endCol: valIdx + target.length + 1,
          });
        }
      }
    }
  }

  // Left-side namespaced Resource binding (e.g. Resource\ZZMI\Diffuse = ref ResourceDiffuse)
  const leftResMatch = /^\s*(Resource\\[a-zA-Z0-9_.\-\\\/]+)\s*=/i.exec(code);
  if (leftResMatch) {
    const leftTarget = leftResMatch[1].trim();
    const valIdx = code.indexOf(leftTarget);
    if (valIdx !== -1) {
      resourceRefs.push({
        name: leftTarget,
        line,
        col: valIdx + 1,
        endCol: valIdx + leftTarget.length + 1,
      });
    }
  }
}

/**
 * Validates referenced resources and command lists exist in file or namespace.
 */
export function checkMissingResources(
  resourceRefs: ResourceRef[],
  sections: Map<string, SectionDef[]>,
  hasFolder: boolean,
  markers: monaco.editor.IMarkerData[],
): void {
  for (const ref of resourceRefs) {
    if (isAllowedResource(ref.name)) continue;
    if (!sections.has(ref.name.toLowerCase())) {
      const isNamespaced = ref.name.includes('\\');
      if (hasFolder && isNamespaced) {
        // Folder mode: delegated to namespace lint rule
        continue;
      }
      let message: string;
      if (!hasFolder && isNamespaced) {
        message = `참조된 섹션 '[${ref.name}]'을(를) 찾을 수 없습니다. 단일 ini 파일로 열려 있어 외부 네임스페이스를 확인할 수 없습니다. 네임스페이스에 정의된 섹션인지 확인해야 합니다.`;
      } else {
        message = `참조된 섹션 '[${ref.name}]'을(를) 찾을 수 없습니다. (다른 include 파일이나 네임스페이스에 정의되어 있다면 정상일 수 있습니다)`;
      }
      markers.push({
        severity: MarkerSeverity.Warning,
        message,
        startLineNumber: ref.line,
        startColumn: ref.col,
        endLineNumber: ref.line,
        endColumn: ref.endCol,
      });
    }
  }
}

/**
 * Validates unused declared resources and command lists.
 */
export function checkUnusedResources(
  sections: Map<string, SectionDef[]>,
  resourceRefs: ResourceRef[],
  hasFolder: boolean,
  markers: monaco.editor.IMarkerData[],
): void {
  const referencedSecNames = new Set(resourceRefs.map((r) => r.name.toLowerCase()));
  for (const [lowerName, defs] of sections) {
    if (
      /^(?:resource|commandlist)/i.test(lowerName) &&
      !referencedSecNames.has(lowerName) &&
      !isAllowedUsedResource(lowerName)
    ) {
      for (const def of defs) {
        let message = `'[${def.name}]' 섹션이 정의되었지만 파일 내에서 참조되지 않았습니다.`;
        if (!hasFolder) {
          message += ' (단일 ini 파일로 열려 있어 외부 네임스페이스나 다른 파일에서의 참조 여부는 확인되지 않습니다)';
        }
        markers.push({
          severity: MarkerSeverity.Info,
          message,
          startLineNumber: def.line,
          startColumn: def.col,
          endLineNumber: def.line,
          endColumn: def.endCol,
        });
      }
    }
  }
}
