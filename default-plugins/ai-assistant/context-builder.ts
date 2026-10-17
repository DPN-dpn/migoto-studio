import type { PluginContext } from '../../src/plugins/types.ts';

export interface PromptTemplateItem {
  label: string;
  text?: string;
  isAction?: boolean;
}

export const AI_TEMPLATES: PromptTemplateItem[] = [
  {
    label: '[분석] 문법 및 오류 분석',
    text: '현재 INI 파일의 문법적 오류나 권장되지 않는 작성 방식을 3DMigoto/XXMI 규격(elif 및 빌트인 키워드 지원) 기준으로 검사하고 개선안을 제시해 줘.',
  },
  {
    label: '[생성] 토글 키 섹션 생성',
    text: 'F1 키를 누르면 텍스처를 켜고 끄는 완전한 [KeyToggle] 및 관련 [Constants], [TextureOverride] 섹션을 만들어 줘.',
  },
  {
    label: '[주석] 섹션 한글 상세 주석',
    text: '현재 파일의 각 섹션 위에 어떤 역할을 하는지 한국어로 상세한 주석을 달아줘.',
  },
  {
    label: '[생성] 텍스처 오버라이드 기본형',
    text: '해시 값을 기반으로 텍스처를 교체하는 표준 [TextureOverride] 섹션 템플릿을 작성해 줘.',
  },
  {
    label: '[생성] 상수 및 커맨드리스트 생성',
    text: '조건 분기 및 변수 제어를 위한 [Constants] 및 [CommandList] 섹션 예제를 만들어 줘.',
  },
  {
    label: '---',
  },
  {
    label: '[지우기] 대화 내역 초기화',
    isAction: true,
  },
];

export function buildPromptContext(
  context: PluginContext,
  userPrompt: string,
  mode: 'smart' | 'full' | 'none',
): {
  promptText: string;
  detail: string;
} {
  if (mode === 'none') {
    return {
      promptText: userPrompt,
      detail: '단독 질의 모드 (에디터 코드 제외)',
    };
  }

  const file = context.workspace.getCurrentFile();
  const currentFileName = file?.name || 'document.ini';
  const fullText = context.editor.getText();
  const allLines = fullText.split('\n');
  const totalLines = allLines.length;

  if (mode === 'full') {
    return {
      promptText: `${userPrompt}\n\n[현재 열린 파일: ${currentFileName} (전체 코드가 전달되었습니다)]\n\`\`\`ini\n${fullText}\n\`\`\``,
      detail: `${currentFileName} (${totalLines}줄 전체 첨부)`,
    };
  }

  // --- [스마트 모드: 개요 + 커서 섹션 + 질문 연관 섹션 발췌] ---
  const doc = context.ini.parse(fullText);
  const cursor = context.editor.getCursor();
  const cursorLine = cursor?.lineNumber || 1;

  // 1. 현재 커서가 위치한 섹션 탐색
  const cursorSection = doc.sections.find(
    (s) => cursorLine >= s.startLine && cursorLine <= s.endLine,
  );

  // 2. 사용자 질문 키워드와 매칭되는 관련 섹션 선별
  const lowerPrompt = userPrompt.toLowerCase();
  const matchedSections: typeof doc.sections = [];

  for (const s of doc.sections) {
    if (cursorSection && s.name === cursorSection.name) continue;
    const lowerName = s.name.toLowerCase();

    const hasNameMatch = lowerPrompt.includes(lowerName);
    const hasPartMatch =
      ((lowerPrompt.includes('hair') || lowerPrompt.includes('헤어')) && lowerName.includes('hair')) ||
      ((lowerPrompt.includes('face') || lowerPrompt.includes('얼굴')) && lowerName.includes('face')) ||
      ((lowerPrompt.includes('body') || lowerPrompt.includes('바디') || lowerPrompt.includes('몸')) && lowerName.includes('body')) ||
      ((lowerPrompt.includes('skirt') || lowerPrompt.includes('치마')) && lowerName.includes('skirt')) ||
      ((lowerPrompt.includes('dress') || lowerPrompt.includes('드레스') || lowerPrompt.includes('옷')) && (lowerName.includes('dress') || lowerName.includes('body'))) ||
      ((lowerPrompt.includes('toggle') || lowerPrompt.includes('토글') || lowerPrompt.includes('키')) && (lowerName.startsWith('key') || lowerName.startsWith('constants'))) ||
      ((lowerPrompt.includes('command') || lowerPrompt.includes('커맨드')) && lowerName.startsWith('commandlist'));

    if (hasNameMatch || hasPartMatch) {
      matchedSections.push(s);
      if (matchedSections.length >= 3) break;
    }
  }

  // 변수나 토글 관련 질문일 경우 Constants 섹션 우선 보강
  const isVariableRelated =
    lowerPrompt.includes('토글') ||
    lowerPrompt.includes('toggle') ||
    lowerPrompt.includes('키') ||
    lowerPrompt.includes('key') ||
    lowerPrompt.includes('변수') ||
    lowerPrompt.includes('$');

  if (isVariableRelated) {
    const constSec = doc.getSection('Constants');
    if (constSec && constSec !== cursorSection && !matchedSections.includes(constSec)) {
      matchedSections.unshift(constSec);
    }
  }

  // 3. 파일 전체 구조 요약본 (Outline) 생성
  const outlineLines: string[] = [];
  outlineLines.push(`[문서 구조 요약 - 총 ${doc.sections.length}개 섹션 선언됨]`);

  for (const s of doc.sections) {
    const grp = context.ini.classifySection(s.name);
    const keyProp = s.properties['hash']
      ? `hash=${s.properties['hash']}`
      : s.properties['key']
        ? `key=${s.properties['key']}`
        : s.properties['type']
          ? `type=${s.properties['type']}`
          : '';
    outlineLines.push(`- [${s.name}] (${grp}${keyProp ? `, ${keyProp}` : ''}, 라인 ${s.startLine}~${s.endLine})`);
  }

  const constSecForVars = doc.getSection('Constants');
  const varNames = constSecForVars ? Object.keys(constSecForVars.variables) : [];
  if (varNames.length > 0) {
    outlineLines.push(`- 선언된 전역 변수: ${varNames.slice(0, 10).join(', ')}${varNames.length > 10 ? ' 외...' : ''}`);
  }

  // 4. 발췌 섹션 본문 묶음 생성
  const excerptBlocks: string[] = [];

  if (cursorSection) {
    excerptBlocks.push(`; [현재 에디터 커서 위치 섹션 (${cursorSection.name})]\n${cursorSection.fullText}`);
  }

  for (const ms of matchedSections) {
    excerptBlocks.push(`; [질문과 연관된 참고 섹션 (${ms.name})]\n${ms.fullText}`);
  }

  if (excerptBlocks.length === 0 && doc.sections.length > 0) {
    const firstSec = doc.sections[0];
    excerptBlocks.push(`; [파일 첫 번째 섹션 (${firstSec.name})]\n${firstSec.fullText}`);
  }

  const smartContextBody = [
    `[현재 열린 파일: ${currentFileName} - 스마트 요약 및 발췌 컨텍스트]`,
    outlineLines.join('\n'),
    '',
    '[수정 및 질문과 관련된 주요 섹션 본문 발췌]',
    excerptBlocks.join('\n\n'),
  ].join('\n');

  const sentLines = smartContextBody.split('\n').length;
  const savingsPercent = totalLines > 0 ? Math.max(0, Math.round(((totalLines - sentLines) / totalLines) * 100)) : 0;

  const targetNames: string[] = [];
  if (cursorSection) targetNames.push(`커서:[${cursorSection.name}]`);
  matchedSections.forEach((m) => targetNames.push(`연관:[${m.name}]`));

  const detail = `${currentFileName} (스마트 발췌: ${sentLines}줄 전달, 원본 ${totalLines}줄 대비 ${savingsPercent}% 토큰 절감, ${targetNames.join(', ') || '개요 전송'})`;

  return {
    promptText: `${userPrompt}\n\n${smartContextBody}`,
    detail,
  };
}
