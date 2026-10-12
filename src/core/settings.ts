import { platform } from '../platform';

/** All user-adjustable options. Add new keys here with a default; old settings files keep working. */
export interface Settings {
  theme: 'dark' | 'light';
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  whitespace: 'none' | 'selection' | 'all';
  /** Show the section list panel on the left. */
  showOutline: boolean;
  /** Keep a safety copy of the previous file before every save (stored in the app data folder). */
  backupOnSave: boolean;
  /** Backups older than this many days are deleted automatically. */
  backupKeepDays: number;
  /** At most this many backups are kept per file. */
  backupMaxPerFile: number;
  recentFiles: string[];

  /** Automatically check for newer releases when the app launches. */
  checkForUpdatesOnStartup: boolean;

  // Linter options
  lintEnabled: boolean;
  lintDuplicateSections: boolean;
  lintUnclosedBlocks: boolean;
  lintComparisonInCondition: boolean;
  lintMissingResources: boolean;
  lintUndeclaredVars: boolean;
  lintUnusedItems: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontSize: 14,
  wordWrap: false,
  minimap: true,
  whitespace: 'selection',
  showOutline: true,
  backupOnSave: true,
  backupKeepDays: 7,
  backupMaxPerFile: 10,
  recentFiles: [],
  checkForUpdatesOnStartup: true,

  lintEnabled: true,
  lintDuplicateSections: true,
  lintUnclosedBlocks: true,
  lintComparisonInCondition: true,
  lintMissingResources: true,
  lintUndeclaredVars: true,
  lintUnusedItems: false,
};

/**
 * Describes every setting shown in the settings screen. The screen is generated from this list,
 * so a new option only needs an entry here (extensions will be able to add entries too).
 */
export type SettingField = {
  key: keyof Omit<Settings, 'recentFiles'>;
  category: string;
  label: string;
  description: string;
} & (
  | { type: 'boolean' }
  | { type: 'number'; min: number; max: number; unit?: string }
  | { type: 'choice'; options: { value: string; label: string }[] }
);

export const SETTING_FIELDS: SettingField[] = [
  {
    key: 'theme', category: '화면', label: '테마', type: 'choice',
    description: '화면의 밝기를 선택합니다.',
    options: [{ value: 'dark', label: '어둡게' }, { value: 'light', label: '밝게' }],
  },
  { key: 'fontSize', category: '화면', label: '글자 크기', type: 'number', min: 8, max: 40, unit: 'px', description: '편집 화면의 글자 크기입니다. (Ctrl + 마우스 휠로도 조절할 수 있습니다)' },
  { key: 'showOutline', category: '화면', label: '섹션 목록 표시', type: 'boolean', description: '왼쪽에 [섹션] 목록 패널을 보여줍니다.' },
  { key: 'minimap', category: '화면', label: '미니맵 표시', type: 'boolean', description: '오른쪽에 문서 전체를 축소해서 보여줍니다.' },
  { key: 'checkForUpdatesOnStartup', category: '화면', label: '시작 시 업데이트 자동 확인', type: 'boolean', description: '앱 실행 시 백그라운드에서 최신 버전이 있는지 확인합니다.' },
  {
    key: 'whitespace', category: '편집', label: '공백 표시', type: 'choice',
    description: '공백과 탭을 점/화살표로 표시합니다.',
    options: [{ value: 'none', label: '표시 안 함' }, { value: 'selection', label: '선택한 부분만' }, { value: 'all', label: '항상' }],
  },
  { key: 'wordWrap', category: '편집', label: '자동 줄바꿈', type: 'boolean', description: '긴 줄을 화면 너비에 맞춰 접어서 보여줍니다.' },
  { key: 'backupOnSave', category: '백업', label: '저장할 때 백업', type: 'boolean', description: '저장하기 전 이전 내용을 앱 데이터 폴더에 보관합니다. 원본 파일 옆에는 아무것도 만들지 않습니다.' },
  { key: 'backupKeepDays', category: '백업', label: '백업 보관 기간', type: 'number', min: 1, max: 365, unit: '일', description: '이 기간이 지난 백업은 자동으로 삭제됩니다.' },
  { key: 'backupMaxPerFile', category: '백업', label: '파일당 최대 백업 수', type: 'number', min: 1, max: 100, unit: '개', description: '한 파일의 백업이 이 개수를 넘으면 오래된 것부터 삭제됩니다.' },
  { key: 'lintEnabled', category: '오류 검사', label: '실시간 오류 검사', type: 'boolean', description: '작성 중인 코드에서 문법 실수나 누락된 부분을 실시간으로 검사합니다.' },
  { key: 'lintDuplicateSections', category: '오류 검사', label: '중복 섹션 검사', type: 'boolean', description: '동일한 이름의 [섹션]이 두 번 이상 정의되었을 때 경고합니다.' },
  { key: 'lintUnclosedBlocks', category: '오류 검사', label: '조건문 (if/endif) 짝 검사', type: 'boolean', description: '닫히지 않은 if문이나 짝이 맞지 않는 else, endif를 검사합니다.' },
  { key: 'lintComparisonInCondition', category: '오류 검사', label: '조건문 비교 연산자 검사', type: 'boolean', description: 'if 조건문 안에서 비교 시 실수로 단일 등호(=)를 사용했는지 검사합니다.' },
  { key: 'lintMissingResources', category: '오류 검사', label: '미존재 리소스/커맨드리스트 참조 검사', type: 'boolean', description: 'run = 또는 vb0 = 등에서 참조한 [Resource/CommandList] 섹션이 파일에 없으면 경고합니다.' },
  { key: 'lintUndeclaredVars', category: '오류 검사', label: '미선언 변수 검사', type: 'boolean', description: '[Constants]에 선언되지 않은 $변수를 사용했을 때 경고합니다. (다른 파일과 분리된 모드에서는 끌 수 있습니다)' },
  { key: 'lintUnusedItems', category: '오류 검사', label: '미사용 리소스/변수 알림', type: 'boolean', description: '선언만 되고 사용되지 않는 리소스나 변수를 정보(파란색)로 표시합니다.' },
];

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: Settings) => void>();

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await platform().loadSettingsText();
    current = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    console.warn('settings: using defaults', e);
    current = { ...DEFAULT_SETTINGS };
  }
  return current;
}

export const getSettings = () => current;

export function onSettingsChange(fn: (s: Settings) => void) {
  listeners.add(fn);
}

export async function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((fn) => fn(current));
  try {
    await platform().saveSettingsText(JSON.stringify(current, null, 2));
  } catch (e) {
    console.error('settings: save failed', e);
  }
}
