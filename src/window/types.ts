/**
 * Migoto Studio 범용 윈도우 관리 시스템 타입 정의
 * 플러그인 및 코어 UI(에디터 분리, 로그 뷰어, 미리보기 등)에서 공통으로 사용됩니다.
 */

export interface SubWindowOptions {
  /** 윈도우 고유 식별자 (동일 ID로 재호출 시 기존 창을 포커스) */
  id: string;
  /** 창 상단 타이틀 */
  title: string;
  /** 창 가로 너비 (기본값: 640) */
  width?: number;
  /** 창 세로 높이 (기본값: 520) */
  height?: number;
  /** 최소 가로 너비 (선택) */
  minWidth?: number;
  /** 최소 세로 높이 (선택) */
  minHeight?: number;
  /** 창 크기 조절(Resize) 가능 여부 (기본값: true) */
  resizable?: boolean;
  /**
   * 창 포커스 및 레이어 배치 모드 (기본값: 'parentLinked')
   * - 'alwaysOnTop': 다른 모든 창보다 항상 위에 고정
   * - 'parentLinked': 미고토 스튜디오에 포커스가 오면 서브창도 함께 전면으로 정렬
   * - 'independent': 메인 창과 완전히 분리되어 OS 작업표시줄에서 독립적으로 포커스
   */
  focusMode?: 'alwaysOnTop' | 'parentLinked' | 'independent';
  /** 초기 실행 시 별도 OS 윈도우(PiP 팝아웃)로 우선 분리할지 여부 (기본값: false) */
  preferPopout?: boolean;
  /** PiP 별도 OS 윈도우 팝아웃 시 독립 실행할 엔트리 스크립트 파일명 (선택) */
  entry?: string;
  /** PiP 별도 OS 윈도우로 전달할 초기 데이터 */
  initialData?: any;
  /** 서브창 내부 UI 렌더링 함수 (정리용 cleanup 함수 반환 가능) */
  render: (container: HTMLElement, subWin: SubWindowHandle) => void | (() => void);
}

export interface SubWindowHandle {
  /** 서브창 닫기 */
  close(): void;
  /** 서브창으로 포커스 이동 */
  focus(): void;
  /** 창 타이틀 동적 변경 */
  setTitle(title: string): void;
  /** 창 크기 동적 조절 */
  resize(width: number, height: number): void;
  /** 포커스 모드 동적 변경 */
  setFocusMode(mode: 'alwaysOnTop' | 'parentLinked' | 'independent'): void;
  /** 창이 열려있는지 여부 */
  isOpen(): boolean;
  /** 창 Window 객체 취득 */
  getWindow(): Window | null;
  /** 별도 OS 윈도우(PiP 팝아웃) 토글 */
  togglePopout(): Promise<boolean>;
  /** 현재 별도 OS 윈도우(PiP 팝아웃) 상태인지 여부 */
  isPoppedOut(): boolean;
  /** 초기 데이터 동적 갱신 (PiP 분리 시 전달되거나 이미 열려 있는 독립 OS 창에 실시간 동기화) */
  setInitialData(data: any): void;
  /** 서브윈도우 및 PiP 분리된 독립 OS 창으로 메시지 전송 */
  postMessage(data: any): void;
  /** 서브윈도우 및 PiP 분리된 독립 OS 창으로부터 수신된 메시지 리스너 등록 (해제 함수 반환) */
  onMessage(listener: (data: any) => void): () => void;
}

export interface NativeWindowOptions {
  /** 윈도우 고유 식별자 (동일 ID로 재호출 시 기존 창을 포커스) */
  id: string;
  /** OS 창 상단 타이틀 */
  title: string;
  /** 창 가로 너비 (기본값: 800) */
  width?: number;
  /** 창 세로 높이 (기본값: 600) */
  height?: number;
  /** 최소 가로 너비 */
  minWidth?: number;
  /** 최소 세로 높이 */
  minHeight?: number;
  /** 창 크기 조절 가능 여부 (기본값: true) */
  resizable?: boolean;
  /** 항상 맨 위 고정 여부 (기본값: false) */
  alwaysOnTop?: boolean;
  /** 화면 중앙 배치 여부 (기본값: true) */
  center?: boolean;
  /** 별도 창에서 독립 실행할 스크립트 파일명 (예: 'subwindow.js') */
  entry?: string;
  /** 직접 주입할 초기 HTML 본문 내용 (선택) */
  html?: string;
  /** 메인 창에서 별도 창으로 전달할 초기 데이터 (선택) */
  initialData?: any;
  /** 서브윈도우에서 분리된 창인지 여부 (내부 관리용) */
  isSubWindowPopout?: boolean;
  /** 내장 창으로 복원하는 콜백 (서브윈도우 팝아웃용) */
  onRestoreToSubWindow?: () => void;
}

export interface ActiveNativeWindowInfo {
  fullId: string;
  ownerId: string;
  id: string;
  title: string;
  isSubWindowPopout?: boolean;
  handle: NativeWindowHandle;
  restoreToSubWindow?: () => void;
  close: () => Promise<void>;
  focus: () => Promise<void>;
}

export interface NativeWindowHandle {
  /** OS 창 닫기 */
  close(): Promise<void>;
  /** OS 창으로 포커스 이동 */
  focus(): Promise<void>;
  /** 창 타이틀 변경 */
  setTitle(title: string): Promise<void>;
  /** 창 크기 변경 */
  setSize(width: number, height: number): Promise<void>;
  /** 메인 창에서 별도 창으로 메시지 전송 */
  postMessage(data: any): void;
  /** 별도 창에서 메인 창으로 보낸 메시지 수신 리스너 등록 (해제 함수 반환) */
  onMessage(listener: (data: any) => void): () => void;
  /** 창이 열려 있는지 여부 */
  isOpen(): boolean;
}

export interface NativeSubWindowContext {
  /** 별도 OS 창의 루트 DOM 컨테이너 */
  container: HTMLElement;
  /** OS 창 제어 핸들 */
  window: {
    close(): Promise<void>;
    focus(): Promise<void>;
    setTitle(title: string): Promise<void>;
    setSize(width: number, height: number): Promise<void>;
  };
  /** 메인 창과의 실시간 양방향 통신 채널 */
  channel: {
    postMessage(data: any): void;
    onMessage(listener: (data: any) => void): () => void;
  };
  /** 메인 창에서 전달된 초기 데이터 */
  initialData?: any;
  /** 모달 지원 */
  modals: {
    confirm(options: any): Promise<boolean>;
    prompt(options: any): Promise<string | null>;
  };
  /** 토스트 알림 */
  showToast(message: string, type?: 'info' | 'warn' | 'error'): void;
  /** UI 빌더 인스턴스 (createToolbar, createSelect, createToggleButton, createStatusBar 등) */
  ui?: any;
  /** 파일 및 디렉터리 I/O 지원 */
  workspace?: any;
  /** 로거 지원 */
  logger?: any;
  /** 타 플러그인 연동 및 API 접근 지원 */
  plugins?: {
    getPluginApi<T = any>(pluginId: string): T | undefined;
    registerApi?(api: any): void;
    hasPluginApi?(pluginId: string): boolean;
  };
  /** 플러그인 전용 로컬 저장소 */
  storage?: {
    get<T = any>(key: string, defaultValue?: T): T;
    set(key: string, value: any): void;
    delete(key: string): void;
  };
  /** 메인 창과 동기화된 3D 모델 및 텍스처 슬롯 API */
  slots?: any;
}
