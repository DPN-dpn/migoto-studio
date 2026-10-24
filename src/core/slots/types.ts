import type { IniDocument, IniSection } from '../ini/ini.ts';

/**
 * 동적으로 파악된 모드 부위 식별자 (모더가 지정한 임의의 부위 이름 허용)
 */
export type ModPartType = string;

export type TextureSlotType = 'diffuse' | 'normal' | 'light' | 'material' | 'fx' | 'custom';

export interface TextureSlot {
  /** 슬롯 고유 식별자 (예: 'Diffuse', 'NormalMap', 'ps-t0', 'ZZMI\\Diffuse' 등) */
  slotId: string;
  /** 텍스처 유형 분류 */
  slotType: TextureSlotType;
  /** 리소스 참조명 (예: 'ResourceRoxybodyADiffuse') */
  resourceRef?: string;
  /** [Resource...] 섹션에서 파일명이 확인된 경우의 텍스처 파일명 (예: 'RoxybodyADiffuse.dds') */
  textureFile?: string;
  /** 파싱된 원본 프로퍼티 라인 (예: 'Resource\\ZZMI\\Diffuse = ref ResourceRoxybodyADiffuse') */
  rawLine?: string;
  /** 해당 텍스처 슬롯이 선언된 섹션명 */
  sourceSection?: string;
  /** 사용자가 수동으로 매칭/수정한 텍스처 슬롯 여부 */
  isManual?: boolean;
}

export interface ModelSlot {
  /** 부위 분류 ('body' | 'head' | 'dress' | 'hair' | 'weapon' 등) */
  part: ModPartType;
  /** 사람이 읽기 쉬운 부위 레이블 (예: '몸체 (Body)', '머리 (Head)') */
  partName: string;
  /** 매칭된 INI 섹션명 (예: 'TextureOverrideRoxybody') */
  sectionName: string;
  /** 섹션이 위치한 INI 파일 경로 */
  filePath: string;
  /** 섹션 시작 줄 번호 */
  startLine?: number;
  /** 인덱스 버퍼 리소스 (ib = ...) */
  ib?: string;
  /** 버텍스 버퍼 리소스 (vb = ...) */
  vb?: string;
  /** 해시값 (hash = ...) */
  hash?: string;
  /** 매칭 첫 인덱스 (match_first_index = ...) */
  matchFirstIndex?: number;
  /** 드로우 인덱스 (drawindexed = ...) */
  drawIndexed?: string;
  /** 핸들링 (handling = ...) */
  handling?: string;
  /** 해당 모델 부위에 바인딩된 텍스처 슬롯 목록 */
  textureSlots: TextureSlot[];
  /** 사용자가 수동으로 매칭/지정한 슬롯인지 여부 */
  isManual?: boolean;
}

export interface UnmatchedSection {
  /** 섹션명 */
  sectionName: string;
  /** 파일 경로 */
  filePath: string;
  /** 줄 번호 */
  startLine?: number;
  /** 식별된 IB 리소스 */
  ib?: string;
  /** 식별된 해시 */
  hash?: string;
  /** 식별된 텍스처 슬롯들 */
  textureSlots: TextureSlot[];
}

export interface TextureSlotResolver {
  /** 리졸버 식별자 (예: 'zzmi-slotfix', 'standard-3dmigoto') */
  id: string;
  /** 리졸버 이름 */
  name?: string;
  /** 실행 우선순위 (숫자가 클수록 먼저 실행, 기본값: 0) */
  priority?: number;
  /**
   * 섹션에서 텍스처 슬롯을 추출합니다.
   * 처리할 수 없는 섹션인 경우 null 또는 undefined를 반환합니다.
   */
  resolveSlots: (
    section: IniSection,
    doc: IniDocument,
    allDocs?: Map<string, IniDocument>,
  ) => TextureSlot[] | null | undefined;
}

export interface SlotAnalysisResult {
  /** 매칭된 모델 및 텍스처 슬롯 목록 */
  slots: ModelSlot[];
  /** 부위 판단이 서지 않아 수동 매칭이 필요한 미분류 섹션 목록 */
  unmatched: UnmatchedSection[];
  /** 분석 완료 타임스탬프 */
  timestamp: number;
}
