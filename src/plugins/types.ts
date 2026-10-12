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

import type { PluginUIBuilder } from './ui-builder.ts';

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
  }) => Promise<LintDiagnostic[]> | LintDiagnostic[];
}

export interface PluginTemplate {
  id?: string;
  label: string;
  description: string;
  body: string;
  group: string;
}

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
    registerContextMenuAction(options: { id: string; label: string; onClick: () => void }): () => void;
    registerCustomViewer(options: CustomViewerDefinition): void;
    registerLintRule(rule: CustomLintRule): () => void;
  };

  // ---- Workspace & files ----
  workspace: {
    getCurrentFile(): { name: string; path: string; location: string } | null;
    getCurrentFolder(): string | null;
    openFile(pathOrName: string): Promise<void>;
    saveCurrentFile(): Promise<void>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, text: string): Promise<void>;
    readBinaryFile(path: string): Promise<Uint8Array>;
    writeBinaryFile(path: string, bytes: Uint8Array): Promise<void>;
    readDirectory(dirPath?: string): Promise<DirEntry[]>;
    pickFile(options?: { extensions?: string[]; title?: string }): Promise<string | null>;
    showInFolder(path: string): Promise<void>;
    onDidChangeActiveFile(listener: (file: { name: string; path: string; location: string } | null) => void): () => void;
  };

  // ---- Linter & Diagnostics ----
  linter: {
    registerRule(rule: CustomLintRule): () => void;
    registerAllowedResource(resourceOrPattern: string | RegExp): () => void;
    registerAllowedVariable(variableOrPattern: string | RegExp | ((name: string) => boolean)): () => void;
  };

  // ---- Templates ----
  templates: {
    registerTemplate(template: PluginTemplate): () => void;
  };

  // ---- UI integration ----
  ui: {
    registerSidebarView(options: {
      id: string;
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
  } & PluginUIBuilder;

  // ---- System execution (desktop) ----
  system: {
    exec(
      command: string,
      args?: string[],
      cwd?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };

  // ---- Persistent plugin storage ----
  storage: {
    get<T = any>(key: string, defaultValue?: T): T;
    set<T = any>(key: string, value: T): void;
  };

  // ---- Network fetch ----
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
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

import type { CustomViewerDefinition } from '../core/documents';
export type { CustomViewerDefinition };

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  isBuiltin: boolean;
  path?: string;
  scriptContent?: string;
  instance?: MigotoPlugin;
  cleanup?: () => void;
  error?: string;
}
