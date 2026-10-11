export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  main?: string;
  category?: 'tools' | 'assets' | 'ai' | 'general';
}

export interface PluginContext {
  manifest: PluginManifest;

  // ---- Editor controls ----
  editor: {
    getText(): string;
    getSelectedText(): string;
    insertText(text: string): void;
    replaceSelection(text: string): void;
    setCursor(line: number, col: number): void;
    getCursor(): { lineNumber: number; column: number };
  };

  // ---- Workspace & files ----
  workspace: {
    getCurrentFile(): { name: string; path: string; location: string } | null;
    getCurrentFolder(): string | null;
    openFile(pathOrName: string): Promise<void>;
    saveCurrentFile(): Promise<void>;
    readTextFile(path: string): Promise<string>;
    readBinaryFile(path: string): Promise<Uint8Array>;
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
  };

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
