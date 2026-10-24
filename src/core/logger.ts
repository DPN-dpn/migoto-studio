/**
 * Migoto Studio - Core Logging System
 *
 * 애플리케이션 전역 로그 및 플러그인 로그를 수집, 필터링, 관리하는 모듈입니다.
 * 브라우저 콘솔과의 안전한 양방향 연동을 지원하며, 링 버퍼로 메모리를 안전하게 관리합니다.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  details?: any[];
}

export interface PluginLogger {
  info(message: string, ...details: any[]): void;
  warn(message: string, ...details: any[]): void;
  error(message: string, ...details: any[]): void;
  debug(message: string, ...details: any[]): void;
}

const MAX_LOG_ENTRIES = 1200;

class AppLogger {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private listeners = new Set<(entry: LogEntry) => void>();
  private clearListeners = new Set<() => void>();
  private isLogging = false;
  private isHooked = false;

  private originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  constructor() {
    this.hookConsole();
  }

  /**
   * 브라우저 기본 console 및 전역 오류를 가로채 콘솔 버퍼에 기록합니다.
   */
  private hookConsole() {
    if (this.isHooked) return;
    this.isHooked = true;

    const self = this;

    const formatArgs = (args: any[]): { message: string; details: any[] } => {
      if (args.length === 0) return { message: '', details: [] };
      const [first, ...rest] = args;
      let msg = '';
      if (typeof first === 'string') {
        msg = first;
      } else {
        try {
          msg = typeof first === 'object' && first !== null ? JSON.stringify(first) : String(first);
        } catch {
          msg = String(first);
        }
      }
      return { message: msg, details: rest };
    };

    console.log = function (...args: any[]) {
      self.originalConsole.log(...args);
      if (self.isLogging) return;
      const { message, details } = formatArgs(args);
      self.logInternal('info', 'Console', message, details);
    };

    console.info = function (...args: any[]) {
      self.originalConsole.info(...args);
      if (self.isLogging) return;
      const { message, details } = formatArgs(args);
      self.logInternal('info', 'Console', message, details);
    };

    console.warn = function (...args: any[]) {
      self.originalConsole.warn(...args);
      if (self.isLogging) return;
      const { message, details } = formatArgs(args);
      self.logInternal('warn', 'Console', message, details);
    };

    console.error = function (...args: any[]) {
      self.originalConsole.error(...args);
      if (self.isLogging) return;
      const { message, details } = formatArgs(args);
      self.logInternal('error', 'Console', message, details);
    };

    console.debug = function (...args: any[]) {
      self.originalConsole.debug(...args);
      if (self.isLogging) return;
      const { message, details } = formatArgs(args);
      self.logInternal('debug', 'Console', message, details);
    };

    // 전역 런타임 오류 캡처
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const msg = event.message || '알 수 없는 스크립트 오류';
        const fileInfo = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
        self.error('Runtime', `${msg}${fileInfo}`, event.error);
      });

      // 처리되지 않은 Promise rejection 캡처
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason?.message || event.reason || 'Unhandled Promise Rejection';
        self.error('Runtime', `[비동기 예외] ${reason}`, event.reason);
      });
    }
  }

  private logInternal(level: LogLevel, source: string, message: string, details?: any[]) {
    this.isLogging = true;
    try {
      const entry: LogEntry = {
        id: this.nextId++,
        timestamp: new Date(),
        level,
        source,
        message,
        details: details && details.length > 0 ? details : undefined,
      };

      this.entries.push(entry);
      if (this.entries.length > MAX_LOG_ENTRIES) {
        this.entries.shift();
      }

      for (const listener of this.listeners) {
        try {
          listener(entry);
        } catch (err) {
          this.originalConsole.error('[AppLogger] Listener exception:', err);
        }
      }
    } finally {
      this.isLogging = false;
    }
  }

  info(source: string, message: string, ...details: any[]): void {
    this.logInternal('info', source, message, details);
    this.originalConsole.info(`[${source}] ${message}`, ...details);
  }

  warn(source: string, message: string, ...details: any[]): void {
    this.logInternal('warn', source, message, details);
    this.originalConsole.warn(`[${source}] ${message}`, ...details);
  }

  error(source: string, message: string, ...details: any[]): void {
    this.logInternal('error', source, message, details);
    this.originalConsole.error(`[${source}] ${message}`, ...details);
  }

  debug(source: string, message: string, ...details: any[]): void {
    this.logInternal('debug', source, message, details);
    this.originalConsole.debug(`[${source}] ${message}`, ...details);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    for (const listener of this.clearListeners) {
      try {
        listener();
      } catch (err) {
        this.originalConsole.error('[AppLogger] Clear listener exception:', err);
      }
    }
  }

  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onClear(listener: () => void): () => void {
    this.clearListeners.add(listener);
    return () => this.clearListeners.delete(listener);
  }

  /**
   * 특정 플러그인 전용 로거 인스턴스를 생성합니다.
   */
  createPluginLogger(pluginId: string, pluginName?: string): PluginLogger {
    const source = `Plugin: ${pluginName || pluginId}`;
    return {
      info: (message: string, ...details: any[]) => this.info(source, message, ...details),
      warn: (message: string, ...details: any[]) => this.warn(source, message, ...details),
      error: (message: string, ...details: any[]) => this.error(source, message, ...details),
      debug: (message: string, ...details: any[]) => this.debug(source, message, ...details),
    };
  }
}

export const appLogger = new AppLogger();
