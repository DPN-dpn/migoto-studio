/**
 * Migoto Studio 범용 윈도우 관리 서브시스템
 * - SubWindowManager: 내부 플로팅 창 및 도킹 관리
 * - NativeWindowManager: 데스크톱 Tauri WebviewWindow 및 브라우저 팝업 기반 독립 OS 창 관리
 *
 * *주의*: 경량 독립 창 부트스트래퍼인 bootNativeWindow는 번들 최적화를 위해
 * './window/native-boot' 경로에서 직접 지연 임포트(Dynamic Import)합니다.
 */

export * from './types';
export { nativeWindowManager, NativeWindowManager } from './native-window';
export { subWindowManager, SubWindowManager } from './sub-window';
