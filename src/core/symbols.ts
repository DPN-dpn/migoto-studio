export interface TextModelLike {
  getLineCount(): number;
  getLineContent(lineNumber: number): string;
}

export interface SymbolIndex {
  variables: Map<string, string>; // varName -> info/detail
  resources: string[];
  commandLists: string[];
  sections: string[];
}

export type SuggestionKind = 'variable' | 'resource' | 'command' | 'section' | 'enum' | 'keyword';

export interface SuggestionItem {
  label: string;
  kind: SuggestionKind;
  detail?: string;
  insertText: string;
  isSnippet?: boolean;
  startCol: number;
  endCol: number;
}

/** Standard section templates suggested when opening a bracket `[` at the start of a line */
export const SECTION_TEMPLATES = [
  { label: '[Constants]', insert: 'Constants]\nglobal persist $${1:myvar} = ${2:0}\n', desc: '전역 변수 선언 섹션' },
  { label: '[KeyToggle]', insert: 'Key${1:Toggle}]\nkey = ${2:no_modifiers} ${3:VK_F1}\ntype = cycle\n$$${4:myvar} = ${5:0,1}\n', desc: '키 입력 토글/순환 변수' },
  { label: '[Present]', insert: 'Present]\nif $$${1:swapvar} == ${2:1}\n\t$0\nendif\n', desc: '프레임 렌더링 시 조건 분기' },
  { label: '[TextureOverride]', insert: 'TextureOverride${1:Name}]\nhash = ${2:00000000}\nmatch_priority = ${3:0}\n', desc: '텍스처/버퍼 해시 오버라이드' },
  { label: '[ShaderOverride]', insert: 'ShaderOverride${1:Name}]\nhash = ${2:0000000000000000}\n', desc: '셰이더 해시 오버라이드' },
  { label: '[ResourceBuffer]', insert: 'Resource${1:Name}]\ntype = Buffer\nstride = ${2:40}\nfilename = ${3:Meshes/File.buf}\n', desc: '메시 버퍼 리소스 정의' },
  { label: '[ResourceTexture]', insert: 'Resource${1:Name}]\nfilename = ${2:Textures/File.dds}\n', desc: '텍스처 파일 리소스 정의' },
  { label: '[CommandList]', insert: 'CommandList${1:Name}]\n$0\n', desc: '재사용 가능한 명령 모음' },
];

/** Common DXGI Buffer Formats */
export const DXGI_FORMATS = [
  'DXGI_FORMAT_R32_UINT',
  'DXGI_FORMAT_R16_UINT',
  'DXGI_FORMAT_R32G32B32A32_FLOAT',
  'DXGI_FORMAT_R32G32B32_FLOAT',
  'DXGI_FORMAT_R16G16B16A16_FLOAT',
  'DXGI_FORMAT_R8G8B8A8_UNORM',
];

/** Strip comments respecting quotes */
export function stripComments(line: string): string {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ';') {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Fast symbol scanner for active model to feed contextual auto-completions.
 */
export function extractSymbols(model: TextModelLike): SymbolIndex {
  const variables = new Map<string, string>();
  const resources: string[] = [];
  const commandLists: string[] = [];
  const sections: string[] = [];

  let currentSection = '';
  const lineCount = model.getLineCount();

  for (let line = 1; line <= lineCount; line++) {
    const raw = model.getLineContent(line);
    const code = stripComments(raw);
    const trimmed = code.trim();
    if (!trimmed) continue;

    // Check section
    const secMatch = /^\s*\[([^\]]+)\]/.exec(code);
    if (secMatch) {
      currentSection = secMatch[1].trim();
      sections.push(currentSection);
      if (/^resource/i.test(currentSection)) resources.push(currentSection);
      else if (/^(?:commandlist|customshader)/i.test(currentSection)) commandLists.push(currentSection);
      continue;
    }

    // Check variable declarations in [Constants] or with global/persist/local
    const isConst = currentSection.toLowerCase() === 'constants';
    const explicitDecl = /\b(?:global|persist|local)\s+\$([a-zA-Z0-9_\\]+)(?:\s*=\s*([^;\r\n]+))?/gi;
    let em: RegExpExecArray | null;
    let foundExplicit = false;

    while ((em = explicitDecl.exec(code)) !== null) {
      foundExplicit = true;
      const vName = em[1];
      const val = em[2]?.trim() ?? '';
      variables.set(vName, val ? `초기값: ${val}` : '전역 변수');
    }

    if (isConst && !foundExplicit) {
      const constAssign = /^\s*\$([a-zA-Z0-9_\\]+)(?:\s*=\s*([^;\r\n]+))?/i.exec(code);
      if (constAssign) {
        const vName = constAssign[1];
        const val = constAssign[2]?.trim() ?? '';
        variables.set(vName, val ? `[Constants] 초기값: ${val}` : '[Constants] 선언 변수');
      }
    }

    // Key cycle variables: $var = 0,1,2
    if (/^key/i.test(currentSection)) {
      const cycleMatch = /^\s*\$([a-zA-Z0-9_\\]+)\s*=\s*([0-9,\s]+)/i.exec(code);
      if (cycleMatch) {
        variables.set(cycleMatch[1], `키 순환 값: ${cycleMatch[2].trim()}`);
      }
    }
  }

  return { variables, resources, commandLists, sections };
}

/**
 * Compute suggestions based on cursor position and line prefix.
 */
export function computeSuggestions(
  symbols: SymbolIndex,
  linePrefix: string,
  lineNumber: number,
  column: number,
): SuggestionItem[] {
  // 1. Variable auto-completion: after `$`
  const dollarIndex = linePrefix.lastIndexOf('$');
  if (dollarIndex !== -1 && dollarIndex >= linePrefix.search(/\S/)) {
    const varTyped = linePrefix.slice(dollarIndex + 1);
    // Only trigger if no space between $ and cursor
    if (!/\s/.test(varTyped)) {
      const startCol = dollarIndex + 1; // 1-based start column in line
      const endCol = column;

      const items: SuggestionItem[] = [];
      for (const [vName, info] of symbols.variables) {
        items.push({
          label: `$${vName}`,
          kind: 'variable',
          detail: info,
          insertText: `$${vName}`,
          startCol,
          endCol,
        });
      }
      return items;
    }
  }

  // 2. Resource slots assignment: vb0 = , ib = , ps-t0 = , Resource =
  const resSlotMatch = /^\s*(?:vb\d+|ib|[a-z]{2}-[tu]\d+|Resource)\s*=\s*([a-zA-Z0-9_]*)$/i.exec(linePrefix);
  if (resSlotMatch) {
    const typedWord = resSlotMatch[1];
    const startCol = column - typedWord.length;

    const items: SuggestionItem[] = symbols.resources.map((res) => ({
      label: res,
      kind: 'resource',
      detail: '리소스 섹션',
      insertText: res,
      startCol,
      endCol: column,
    }));

    items.push({
      label: 'null',
      kind: 'keyword',
      detail: '슬롯 비우기 (바인딩 해제)',
      insertText: 'null',
      startCol,
      endCol: column,
    });

    return items;
  }

  // 3. CommandList / CustomShader execution: run = , post run = , pre run =
  const runMatch = /^\s*(?:(?:post|pre)\s+)?run\s*=\s*([a-zA-Z0-9_]*)$/i.exec(linePrefix);
  if (runMatch) {
    const typedWord = runMatch[1];
    const startCol = column - typedWord.length;

    return symbols.commandLists.map((cmd) => ({
      label: cmd,
      kind: 'command',
      detail: '커맨드 리스트 / 셰이더',
      insertText: cmd,
      startCol,
      endCol: column,
    }));
  }

  // 4. Section header start: `[` at the start of a line
  const secStartMatch = /^\s*\[([a-zA-Z0-9_]*)$/.exec(linePrefix);
  if (secStartMatch) {
    const startCol = linePrefix.indexOf('[') + 1;

    return SECTION_TEMPLATES.map((tmpl) => ({
      label: tmpl.label,
      kind: 'section',
      detail: tmpl.desc,
      insertText: tmpl.insert,
      isSnippet: true,
      startCol,
      endCol: column,
    }));
  }

  // 5. Format specification: format = DXGI_
  const formatMatch = /^\s*format\s*=\s*([a-zA-Z0-9_]*)$/i.exec(linePrefix);
  if (formatMatch) {
    const typedWord = formatMatch[1];
    const startCol = column - typedWord.length;

    return DXGI_FORMATS.map((fmt) => ({
      label: fmt,
      kind: 'enum',
      detail: 'DXGI 버퍼 포맷',
      insertText: fmt,
      startCol,
      endCol: column,
    }));
  }

  return [];
}
