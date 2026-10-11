import { invoke } from '@tauri-apps/api/core';

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
};

/**
 * Describes every setting shown in the settings screen. The screen is generated from this list,
 * so a new option only needs an entry here (plugins will be able to add entries too).
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
  {
    key: 'whitespace', category: '편집', label: '공백 표시', type: 'choice',
    description: '공백과 탭을 점/화살표로 표시합니다.',
    options: [{ value: 'none', label: '표시 안 함' }, { value: 'selection', label: '선택한 부분만' }, { value: 'all', label: '항상' }],
  },
  { key: 'wordWrap', category: '편집', label: '자동 줄바꿈', type: 'boolean', description: '긴 줄을 화면 너비에 맞춰 접어서 보여줍니다.' },
  { key: 'backupOnSave', category: '백업', label: '저장할 때 백업', type: 'boolean', description: '저장하기 전 이전 내용을 앱 데이터 폴더에 보관합니다. 원본 파일 옆에는 아무것도 만들지 않습니다.' },
  { key: 'backupKeepDays', category: '백업', label: '백업 보관 기간', type: 'number', min: 1, max: 365, unit: '일', description: '이 기간이 지난 백업은 자동으로 삭제됩니다.' },
  { key: 'backupMaxPerFile', category: '백업', label: '파일당 최대 백업 수', type: 'number', min: 1, max: 100, unit: '개', description: '한 파일의 백업이 이 개수를 넘으면 오래된 것부터 삭제됩니다.' },
];

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: Settings) => void>();

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await invoke<string>('load_settings');
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
    await invoke('save_settings', { json: JSON.stringify(current, null, 2) });
  } catch (e) {
    console.error('settings: save failed', e);
  }
}
