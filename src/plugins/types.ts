import type { IniSection, IniDocument, IniMergeResult, IniSectionLine } from '../core/ini/ini.ts';
export type { IniSection, IniDocument, IniMergeResult, IniSectionLine } from '../core/ini/ini.ts';
import type { PluginLogger } from '../core/logger.ts';
export type { PluginLogger };
import type { ModelSlot, ModPartType, TextureSlot, TextureSlotType, TextureSlotResolver } from '../core/slots/types.ts';
export type { ModelSlot, ModPartType, TextureSlot, TextureSlotType, TextureSlotResolver };
import type { PluginGitHubSource } from './github.ts';
export type { PluginGitHubSource };

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  main?: string;
  category?: 'tools' | 'assets' | 'ai' | 'general';
  location?: string;
}

/**
 * 플러그인 아이콘 문자열(SVG 코드, 이미지 URL, 이모지, 텍스트)을 HTML 마크업으로 렌더링합니다.
 */
export function renderPluginIcon(icon: string | undefined | null, fallback = 'PLG'): string {
  if (!icon) return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<img')) return trimmed;
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `<img src="${trimmed}" alt="icon" style="width:18px;height:18px;object-fit:contain;" />`;
  }
  return trimmed;
}

import type {
  PluginUIBuilder,
  ConfirmOptions,
  PromptOptions,
  SplitViewOptions,
  SplitViewInstance,
  RowOptions,
  ColumnOptions,
  GridOptions,
  DividerOptions,
  ScrollContainerOptions,
  ScrollContainerInstance,
  TabDef,
  TabsOptions,
  TabsInstance,
  CollapsibleOptions,
  CollapsibleInstance,
  SegmentOption,
  SegmentedControlOptions,
  SegmentedControlInstance,
  SearchInputOptions,
  SearchInputInstance,
  FilePickerOptions,
  FilePickerInstance,
  TooltipOptions,
  DropZoneOptions,
  DropZoneInstance,
  ButtonOptions,
  IconButtonOptions,
  ButtonInstance,
  ChipOption,
  ChipGroupOptions,
  ChipGroupInstance,
  ModalWidth,
  ModalOptions,
  ModalInstance,
} from './ui-builder.ts';
export type {
  ConfirmOptions,
  PromptOptions,
  SplitViewOptions,
  SplitViewInstance,
  RowOptions,
  ColumnOptions,
  GridOptions,
  DividerOptions,
  ScrollContainerOptions,
  ScrollContainerInstance,
  TabDef,
  TabsOptions,
  TabsInstance,
  CollapsibleOptions,
  CollapsibleInstance,
  SegmentOption,
  SegmentedControlOptions,
  SegmentedControlInstance,
  SearchInputOptions,
  SearchInputInstance,
  FilePickerOptions,
  FilePickerInstance,
  TooltipOptions,
  DropZoneOptions,
  DropZoneInstance,
  ButtonOptions,
  IconButtonOptions,
  ButtonInstance,
  ChipOption,
  ChipGroupOptions,
  ChipGroupInstance,
  ModalWidth,
  ModalOptions,
  ModalInstance,
};
import type { KeyHelperModalOptions } from '../ui/modals/key-helper.ts';
export type { KeyHelperModalOptions };
import type { VkKeyItem, ModifierState, KeyBindingComponents } from '../core/ini/keys.ts';
export type { VkKeyItem, ModifierState, KeyBindingComponents };

export interface PluginDiffOptions {
  title?: string;
  originalTitle: string;
  modifiedTitle: string;
  originalText: string;
  modifiedText: string;
  languageId?: string;
}

export interface PluginTabInfo {
  id: string;
  title: string;
  path: string | null;
  isDirty: boolean;
  kind: string;
  isActive: boolean;
}

export interface WorkspaceSearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface WorkspaceSearchResult {
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  lineContent: string;
  matchedText: string;
}

export interface IniSymbolsResult {
  variables: Record<string, string>;
  resources: string[];
  commandLists: string[];
  sections: string[];
}

export interface SelectOption {
  value: string;
  label: string;
}

import type { DirEntry } from '../platform/types.ts';
export type { DirEntry };

export interface LintDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface DiagnosticFilterContext {
  model: {
    getLineCount(): number;
    getLineContent(lineNumber: number): string;
    getValue(): string;
  };
  file: { name: string; path: string; location: string } | null;
  folder: string | null;
}

export type DiagnosticFilter = (
  diagnostic: LintDiagnostic,
  context: DiagnosticFilterContext,
) => boolean;

export interface CustomLintRule {
  id: string;
  name: string;
  check: (context: {
    model: {
      getLineCount(): number;
      getLineContent(lineNumber: number): string;
      getValue(): string;
    };
    file: { name: string; path: string; location: string } | null;
    folder: string | null;
    fileExists: (relativePath: string) => Promise<boolean>;
    readTextFile?: (relativePath: string) => Promise<string>;
    getAllFiles?: () => string[];
    isAllowedResource?: (name: string) => boolean;
    isAllowedVariable?: (name: string) => boolean;
  }) => Promise<LintDiagnostic[]> | LintDiagnostic[];
}

export interface SymbolLocation {
  filePath: string;
  fileRef?: any;
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  lineContent?: string;
  section?: string;
  isDefinition?: boolean;
}

export interface CustomDefinitionProvider {
  provideDefinition: (
    target: {
      name: string;
      cleanName: string;
      kind: 'variable' | 'section' | 'namespace';
      namespace?: string;
    },
    context: {
      model: {
        getValue(): string;
        getLineContent(lineNumber: number): string;
        getLineCount(): number;
      };
      file: { name: string; path: string; location: string } | null;
      folder: string | null;
      getAllFiles?: () => string[];
      readTextFile?: (path: string) => Promise<string>;
    },
  ) => Promise<SymbolLocation | null> | SymbolLocation | null;
}

export interface CustomReferenceProvider {
  provideReferences: (
    target: {
      name: string;
      cleanName: string;
      kind: 'variable' | 'section' | 'namespace';
      namespace?: string;
    },
    context: {
      model: {
        getValue(): string;
        getLineContent(lineNumber: number): string;
        getLineCount(): number;
      };
      file: { name: string; path: string; location: string } | null;
      folder: string | null;
      getAllFiles?: () => string[];
      readTextFile?: (path: string) => Promise<string>;
    },
  ) => Promise<SymbolLocation[]> | SymbolLocation[];
}

export interface ProposeChangesOptions {
  title?: string;
  description?: string;
  highlightOnly?: boolean;
}

export interface ProposeChangesResult {
  accepted: boolean;
}

export interface PluginTemplate {
  id?: string;
  label: string;
  description: string;
  body: string;
  group: string;
}

export type FormFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'key'
  | 'textarea'
  | 'color';

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  default?: any;
  placeholder?: string;
  description?: string;
  options?: Array<string | SelectOption>;
  min?: number;
  max?: number;
  step?: number;
  integerOnly?: boolean;
  precision?: number;
}

export interface NumberInputOptions {
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  integerOnly?: boolean;
  precision?: number;
  clampOnBlur?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  onChange?: (value: number) => void;
  onInput?: (value: number) => void;
}

export interface NumberInputInstance {
  element: HTMLElement;
  row: HTMLElement;
  container: HTMLElement;
  input: HTMLInputElement;
  decBtn: HTMLButtonElement;
  incBtn: HTMLButtonElement;
  getValue: () => number;
  setValue: (value: number) => void;
  setDisabled: (disabled: boolean) => void;
  setMin: (min: number | undefined) => void;
  setMax: (max: number | undefined) => void;
  setStep: (step: number | undefined) => void;
  getElement: () => HTMLElement;
  setError: (message: string) => void;
  clearError: () => void;
  hasError: () => boolean;
  destroy?: () => void;
}

export interface FormSectionDef {
  title?: string;
  description?: string;
  fields: FormFieldDef[];
}

export interface FormConfig {
  title?: string;
  description?: string;
  badge?: string;
  sections?: FormSectionDef[];
  fields?: FormFieldDef[];
  initialValues?: Record<string, any>;
  submitLabel?: string;
  resetLabel?: string;
  showReset?: boolean;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onReset?: () => void;
  onChange?: (values: Record<string, any>, fieldId: string) => void;
}

export interface FormInstance {
  element: HTMLElement;
  getValues: () => Record<string, any>;
  setValues: (values: Record<string, any>) => void;
  reset: () => void;
}

import type {
  SubWindowOptions,
  SubWindowHandle,
  NativeWindowOptions,
  NativeWindowHandle,
  NativeSubWindowContext,
} from '../window';
export type {
  SubWindowOptions,
  SubWindowHandle,
  NativeWindowOptions,
  NativeWindowHandle,
  NativeSubWindowContext,
};


export interface PluginContext {
  manifest: PluginManifest;

  // ---- Editor controls ----
  editor: {
    getText(): string;
    getSelectedText(): string;
    setText(text: string): void;
    getLine(lineNumber: number): string;
    getLineCount(): number;
    insertText(text: string): void;
    replaceSelection(text: string): void;
    setCursor(line: number, col: number): void;
    getCursor(): { lineNumber: number; column: number };
    onDidChangeText(listener: (text: string) => void): () => void;
    onDidChangeCursor(listener: (cursor: { lineNumber: number; column: number }) => void): () => void;
    registerContextMenuAction(options: {
      id: string;
      label: string;
      contextMenuGroupId?: string;
      contextMenuOrder?: number;
      onClick: () => void;
    }): () => void;
    registerCustomViewer(options: CustomViewerDefinition): void;
    registerLintRule(rule: CustomLintRule): () => void;
    registerDefinitionProvider?(provider: CustomDefinitionProvider): () => void;
    registerReferenceProvider?(provider: CustomReferenceProvider): () => void;
    proposeChanges(newText: string, options?: ProposeChangesOptions): Promise<ProposeChangesResult>;
  };

  // ---- Workspace & files ----
  workspace: {
    getCurrentFile(): { name: string; path: string; location: string } | null;
    getCurrentFolder(): string | null;
    openFile(pathOrName: string, line?: number, col?: number): Promise<void>;
    saveCurrentFile(): Promise<void>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, text: string): Promise<void>;
    readBinaryFile(path: string): Promise<Uint8Array>;
    writeBinaryFile(path: string, bytes: Uint8Array): Promise<void>;
    readDirectory(dirPath?: string): Promise<DirEntry[]>;
    pickFile(options?: { extensions?: string[]; title?: string }): Promise<string | null>;
    showInFolder(path: string): Promise<void>;
    onDidChangeActiveFile(listener: (file: { name: string; path: string; location: string } | null) => void): () => void;
    /** 작업 폴더가 열리거나 닫힐 때 발생하는 이벤트 (열렸을 때 절대 경로 string, 닫혔을 때 null) */
    onDidChangeActiveFolder(listener: (folder: string | null) => void): () => void;
    /** 파일 저장이 완료되었을 때 발생하는 이벤트 (저장된 파일의 절대 경로와 파일명 전달) */
    onDidSaveFile(listener: (file: { path: string; name: string }) => void): () => void;
    /** 에디터 탭이 닫혔을 때 발생하는 이벤트 (닫힌 탭 ID, 파일 경로, 탭 제목 전달) */
    onDidCloseTab(listener: (tab: { tabId: string; filePath: string | null; title: string }) => void): () => void;
    /** 모드 폴더 닫기/변경 또는 작업 영역 초기화로 메모리가 제거될 때 발생하는 이벤트 (플러그인 자체 캐시/메모리 정리용) */
    onDidClearMemory(listener: (event: { reason: 'folder_closed' | 'folder_changed' | 'reset' }) => void): () => void;
    /** onDidClearMemory의 별칭 (작업 영역 탭 및 메모리 초기화 감지) */
    onDidResetWorkspace(listener: (event: { reason: 'folder_closed' | 'folder_changed' | 'reset' }) => void): () => void;
    /** glob 패턴(예: '**\/*.ini')을 기준으로 워크스페이스 내 파일 목록을 고속 검색하여 반환 */
    findFiles(globPattern: string, options?: { cwd?: string; maxResults?: number }): Promise<string[]>;
    search(query: string, options?: WorkspaceSearchOptions): Promise<WorkspaceSearchResult[]>;
    createBackup(filePath?: string, label?: string): Promise<string | null>;
    getOpenTabs(): PluginTabInfo[];
    closeTab(tabId: string): Promise<boolean>;
    focusTab(tabId: string): void;
  };

  // ---- Linter & Diagnostics ----
  linter: {
    registerRule(rule: CustomLintRule): () => void;
    registerDiagnosticFilter(filter: DiagnosticFilter): () => void;
    registerAllowedResource(resourceOrPattern: string | RegExp | ((name: string) => boolean)): () => void;
    registerAllowedVariable(variableOrPattern: string | RegExp | ((name: string) => boolean)): () => void;
    registerAllowedUsedResource(resourceOrPattern: string | RegExp | ((name: string) => boolean)): () => void;
    registerAllowedUsedVariable(variableOrPattern: string | RegExp | ((name: string) => boolean)): () => void;
    registerDefinitionProvider?(provider: CustomDefinitionProvider): () => void;
    registerReferenceProvider?(provider: CustomReferenceProvider): () => void;
  };

  // ---- Languages & Navigation ----
  languages?: {
    registerDefinitionProvider(provider: CustomDefinitionProvider): () => void;
    registerReferenceProvider(provider: CustomReferenceProvider): () => void;
  };

  // ---- Templates ----
  templates: {
    registerTemplate(template: PluginTemplate): () => void;
  };

  // ---- INI parsing & structure analysis ----
  ini: {
    parse(text?: string): IniDocument;
    classifySection(name: string): string;
    merge(targetText: string, sourceText: string, options?: { appendNew?: boolean }): IniMergeResult;
    formatSection(name: string, properties: Record<string, string>, options?: { comments?: string[]; variables?: Record<string, string> }): string;
    formatKeyToggle(options: {
      sectionName?: string;
      key: string;
      type?: 'cycle' | 'hold';
      states?: number | string[];
      variableName?: string;
      condition?: string;
      comments?: string[];
    }): string;
    parseKeyBinding(text: string): KeyBindingComponents;
    formatKeyBinding(options: {
      vk: string;
      ctrl?: ModifierState;
      alt?: ModifierState;
      shift?: ModifierState;
      win?: ModifierState;
    }): string;
    getKeyList(): VkKeyItem[];
    getSections(text?: string): IniSection[];
    findSection(nameOrPattern: string | RegExp, text?: string): IniSection | undefined;
    getVariables(text?: string): Record<string, string>;
    upsertSection(name: string, properties: Record<string, string>, options?: { comments?: string[]; variables?: Record<string, string>; replaceExisting?: boolean }): void;
    deleteSection(name: string): boolean;
    extractSymbols(text?: string): IniSymbolsResult;
    formatDisplayKey(rawKey?: string | null): string;
    getSectionRaw(sectionName: string, text?: string): string | null;
    setSectionRaw(sectionName: string, rawContent: string): void;
    parseSectionLines(sectionName: string, text?: string): IniSectionLine[] | null;
  };

  // ---- UI integration ----
  ui: {
    registerSidebarView(options: {
      id: string;
      pluginId?: string;
      title: string;
      icon: string;
      render: (container: HTMLElement) => void | (() => void);
    }): void;
    showModal(title: string, render: (container: HTMLElement, close: () => void) => void): void;
    showToast(message: string, type?: 'info' | 'warn' | 'error'): void;
    registerStatusBarItem(options: {
      id: string;
      text: string;
      tooltip?: string;
      onClick?: () => void;
    }): void;
    openTab(options: {
      id: string;
      title: string;
      icon?: string;
      render: (container: HTMLElement) => void | (() => void);
    }): { close: () => void; focus: () => void };
    openFormTab(options: {
      id: string;
      title: string;
      icon?: string;
      form: FormConfig;
    }): {
      close: () => void;
      focus: () => void;
      getValues: () => Record<string, any>;
      setValues: (values: Record<string, any>) => void;
      reset: () => void;
    };
    registerMenuItem(options: {
      label: string;
      shortcut?: string;
      action: () => void;
    }): () => void;
    openDiffTab(options: PluginDiffOptions): { id: string; close: () => void; focus: () => void };
    openRestoreModal(filePath?: string): void;
    openKeyBindingModal(options?: KeyHelperModalOptions): Promise<string | null>;
    openKeyHelperModal(options?: KeyHelperModalOptions): Promise<string | null>;
    confirm(options: ConfirmOptions): Promise<boolean>;
    prompt(options: PromptOptions): Promise<string | null>;
    openSubWindow(options: SubWindowOptions): SubWindowHandle;
    openNativeWindow(options: NativeWindowOptions): Promise<NativeWindowHandle>;
    /** 현재 에디터 테마 조회 ('dark' | 'light') */
    getTheme(): 'dark' | 'light';
    /** 에디터 테마 변경 시 발생하는 이벤트 ('dark' | 'light') */
    onDidChangeTheme(listener: (event: { theme: 'dark' | 'light' }) => void): () => void;
  } & PluginUIBuilder;

  // ---- 3D Model & Texture Slots ----
  slots: {
    /** 현재 분석/매칭된 모든 부위의 모델 및 텍스처 슬롯 목록 반환 */
    getSlots(): ModelSlot[];
    /** 특정 부위(head, body, dress, hair 등)에 매칭된 모델 슬롯 반환 */
    getSlot(part: ModPartType | string): ModelSlot | undefined;
    /** 슬롯 매칭 또는 분석 결과가 변경되었을 때 호출되는 리스너 등록 */
    onDidChangeSlots(listener: (slots: ModelSlot[]) => void): () => void;
    /** 모드 폴더 및 INI 파일들을 다시 스캔하여 슬롯 분석 갱신 */
    refreshSlots(): Promise<ModelSlot[]>;
    /** 특정 섹션의 부위를 수동으로 지정/매칭 */
    setPartMapping(sectionName: string, part: ModPartType | string): void;
    /** 특정 섹션의 텍스처 슬롯 파일명을 수동으로 지정/수정 */
    setTextureSlot(sectionName: string, slotId: string, textureFile: string, slotType?: TextureSlotType): void;
    /** 특정 섹션의 텍스처 슬롯을 수동 삭제 */
    removeTextureSlot(sectionName: string, slotId: string): void;
    /** INI 파일들에서 감지된 텍스처/이미지 파일명 목록 조회 */
    getDetectedTextureFiles(): string[];
    /** 게임/엔진별 특수 텍스처 구문(예: ZZMI SlotFix 등)을 해석하기 위한 커스텀 리졸버 등록 */
    registerTextureSlotResolver(resolver: TextureSlotResolver): () => void;
  };

  // ---- Plugin lifecycle events & state ----
  plugins: {
    /** 현재 등록된 모든 플러그인 목록 조회 */
    getPlugins(): Array<{ id: string; name: string; version: string; enabled: boolean; isBuiltin: boolean }>;
    /** 특정 플러그인의 활성화 여부 확인 */
    isEnabled(pluginId: string): boolean;
    /** 플러그인 활성화/비활성화/설치/삭제 이벤트 리스너 등록 */
    onDidChangePlugins(listener: (event: PluginLifecycleEvent) => void): () => void;
    /** GitHub 링크로부터 플러그인을 다운로드하여 설치 */
    installFromGitHub(url: string): Promise<boolean>;
    /** GitHub 출처 플러그인들의 최신 릴리스 버전 체크 트리거 */
    checkUpdates(): Promise<void>;
    /** 특정 플러그인의 GitHub 출처 정보 조회 */
    getGitHubSource(pluginId: string): PluginGitHubSource | undefined;
  };

  // ---- System execution (desktop) ----
  system: {
    exec(
      command: string,
      args?: string[],
      cwd?: string,
      stdin?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };

  // ---- Persistent plugin storage ----
  storage: {
    get<T = any>(key: string, defaultValue?: T): T;
    set<T = any>(key: string, value: T): void;
  };

  // ---- Network fetch ----
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

  // ---- Logging ----
  logger: PluginLogger;
}

export interface MigotoPlugin {
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export interface RegisteredSidebarView {
  id: string;
  pluginId: string;
  title: string;
  icon: string;
  render: (container: HTMLElement) => void | (() => void);
}

import type { CustomViewerDefinition } from '../core/workspace/documents.ts';
export type { CustomViewerDefinition };

export type PluginLifecycleAction = 'activated' | 'deactivated' | 'installed' | 'uninstalled';

export interface PluginLifecycleEvent {
  action: PluginLifecycleAction;
  pluginId: string;
  manifest: PluginManifest;
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  isBuiltin: boolean;
  path?: string;
  scriptContent?: string;
  entryPath?: string;
  files?: Record<string, string>;
  instance?: MigotoPlugin;
  cleanup?: () => void;
  error?: string;
}

export interface PluginMenuItemDef {
  label: string;
  shortcut?: string;
  action: () => void;
}

export interface PluginMenuGroup {
  pluginId: string;
  pluginName: string;
  icon?: string;
  items: PluginMenuItemDef[];
}

