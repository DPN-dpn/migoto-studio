import type { SubWindowOptions, SubWindowHandle } from './types.ts';

export class SubWindowManager {
  private activeWindows: Map<string, {
    subWin: Window;
    handle: SubWindowHandle;
    cleanup?: () => void;
  }> = new Map();

  constructor() {
    // 메인 창이 닫힐 때 모든 열린 서브창 일괄 닫기
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.closeAllWindows();
      });
    }
  }

  /**
   * 플러그인 전용 서브 윈도우를 띄웁니다.
   */
  openSubWindow(
    pluginId: string,
    options: SubWindowOptions,
    onRegisterCleanup?: (cleanup: () => void) => void
  ): SubWindowHandle {
    const fullId = `plugin_${pluginId}_${options.id}`;

    // 1. 이미 열려 있는 서브창이 있으면 포커스 후 기존 핸들 반환
    const existing = this.activeWindows.get(fullId);
    if (existing && !existing.subWin.closed) {
      existing.subWin.focus();
      return existing.handle;
    }

    const width = Math.max(200, options.width ?? 640);
    const height = Math.max(150, options.height ?? 520);
    const resizable = options.resizable !== false;

    // 모니터 중앙 또는 메인 창 중앙 좌표 계산
    const screenX = typeof window.screenX !== 'undefined' ? window.screenX : 0;
    const screenY = typeof window.screenY !== 'undefined' ? window.screenY : 0;
    const outerW = window.outerWidth || 1024;
    const outerH = window.outerHeight || 768;
    const left = Math.max(0, Math.round(screenX + (outerW - width) / 2));
    const top = Math.max(0, Math.round(screenY + (outerH - height) / 2));

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      `resizable=${resizable ? 'yes' : 'no'}`,
      'scrollbars=yes',
      'status=no',
      'menubar=no',
      'toolbar=no',
      'location=no',
    ].join(',');

    const subWin = window.open('about:blank', `migoto_subwin_${pluginId}_${options.id}`, features);
    if (!subWin || subWin.closed || typeof subWin.closed === 'undefined') {
      throw new Error('서브 윈도우 생성에 실패했습니다. 브라우저의 팝업 차단 설정을 확인해주세요.');
    }

    const subDoc = subWin.document;
    subDoc.title = options.title || 'Migoto Studio Sub Window';

    // 2. 메인 창의 CSS 스타일시트 및 테마 속성 복제
    try {
      const headElements = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      headElements.forEach((el) => {
        const clone = el.cloneNode(true);
        subDoc.head.appendChild(clone);
      });

      // 테마 클래스 및 인라인 스타일 동기화
      subDoc.documentElement.className = document.documentElement.className;
      subDoc.documentElement.style.cssText = document.documentElement.style.cssText;
    } catch (e) {
      console.warn('[SubWindowManager] 스타일 복제 중 경고:', e);
    }

    // 3. 서브창 내부 기본 스타일 설정
    subDoc.body.style.cssText = `
      margin: 0;
      padding: 0;
      background-color: var(--bg-primary, #0d1117);
      color: var(--text-color, #e6edf3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      user-select: auto;
    `;

    // 4. 서브창 상단 유틸리티 헤더 (포커스 모드 배지 및 타이틀)
    const headerBar = subDoc.createElement('div');
    headerBar.className = 'subwindow-header-bar';
    headerBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: var(--bg-secondary, #161b22);
      border-bottom: 1px solid var(--border-color, #30363d);
      font-size: 11px;
      color: var(--text-muted, #8b949e);
      user-select: none;
      flex-shrink: 0;
    `;

    const titleEl = subDoc.createElement('span');
    titleEl.className = 'subwindow-title-text';
    titleEl.textContent = options.title || '서브 윈도우';
    titleEl.style.cssText = `
      font-weight: 600;
      color: var(--text-color, #e6edf3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const modeBadgeContainer = subDoc.createElement('div');
    modeBadgeContainer.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const modeBadge = subDoc.createElement('span');
    modeBadge.className = 'subwindow-mode-badge';
    modeBadge.style.cssText = `
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
    `;

    modeBadgeContainer.appendChild(modeBadge);
    headerBar.appendChild(titleEl);
    headerBar.appendChild(modeBadgeContainer);
    subDoc.body.appendChild(headerBar);

    // 5. 플러그인 컨텐츠 루트 컨테이너
    const rootContainer = subDoc.createElement('div');
    rootContainer.className = 'plugin-subwindow-content';
    rootContainer.style.cssText = `
      flex: 1 1 0;
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: auto;
      padding: 12px 16px;
      box-sizing: border-box;
      position: relative;
    `;
    subDoc.body.appendChild(rootContainer);

    // 6. 포커스 모드 핸들러
    let currentMode: 'alwaysOnTop' | 'parentLinked' | 'independent' = options.focusMode ?? 'parentLinked';
    let parentFocusCleanup: (() => void) | null = null;
    let subBlurCleanup: (() => void) | null = null;

    const updateModeBadgeUi = () => {
      if (currentMode === 'alwaysOnTop') {
        modeBadge.textContent = '📌 항상 맨 위';
        modeBadge.style.background = 'rgba(240, 136, 62, 0.2)';
        modeBadge.style.color = '#f0883e';
        modeBadge.title = '다른 모든 창보다 화면 최상단에 유지됩니다. (클릭하여 모드 전환)';
      } else if (currentMode === 'parentLinked') {
        modeBadge.textContent = '🔗 에디터 연동';
        modeBadge.style.background = 'rgba(56, 139, 253, 0.2)';
        modeBadge.style.color = '#58a6ff';
        modeBadge.title = 'Migoto Studio 에디터에 포커스가 오면 서브창도 함께 전면으로 올라옵니다. (클릭하여 모드 전환)';
      } else {
        modeBadge.textContent = '🗗 독립 창';
        modeBadge.style.background = 'rgba(139, 148, 158, 0.2)';
        modeBadge.style.color = '#8b949e';
        modeBadge.title = '메인 에디터와 완전히 독립적으로 동작합니다. (클릭하여 모드 전환)';
      }
    };

    const applyFocusMode = (mode: 'alwaysOnTop' | 'parentLinked' | 'independent') => {
      currentMode = mode;
      updateModeBadgeUi();

      if (parentFocusCleanup) {
        parentFocusCleanup();
        parentFocusCleanup = null;
      }
      if (subBlurCleanup) {
        subBlurCleanup();
        subBlurCleanup = null;
      }

      if (mode === 'parentLinked') {
        // 메인 창이 포커스되면 서브창도 함께 포커스하여 위로 올림
        const onMainFocus = () => {
          if (subWin && !subWin.closed) {
            subWin.focus();
          }
        };
        window.addEventListener('focus', onMainFocus);
        parentFocusCleanup = () => window.removeEventListener('focus', onMainFocus);
      } else if (mode === 'alwaysOnTop') {
        // 메인 창 포커스 시 서브창을 즉시 위로 복원
        const onMainFocus = () => {
          if (currentMode === 'alwaysOnTop' && subWin && !subWin.closed) {
            subWin.focus();
          }
        };
        window.addEventListener('focus', onMainFocus);

        // 서브창 blur 시 포커스 복원 유지 (always-on-top 에뮬레이션)
        let blurTimer: any = null;
        const onSubBlur = () => {
          if (currentMode !== 'alwaysOnTop' || !subWin || subWin.closed) return;
          clearTimeout(blurTimer);
          blurTimer = setTimeout(() => {
            if (currentMode === 'alwaysOnTop' && subWin && !subWin.closed) {
              subWin.focus();
            }
          }, 80);
        };
        subWin.addEventListener('blur', onSubBlur);

        parentFocusCleanup = () => {
          clearTimeout(blurTimer);
          window.removeEventListener('focus', onMainFocus);
        };
        subBlurCleanup = () => {
          clearTimeout(blurTimer);
          subWin.removeEventListener('blur', onSubBlur);
        };
      }
      // independent: 부모 포커스 리스너 없음
    };

    // 배지 클릭 시 모드 순환 전환
    modeBadge.onclick = () => {
      if (currentMode === 'parentLinked') {
        applyFocusMode('alwaysOnTop');
      } else if (currentMode === 'alwaysOnTop') {
        applyFocusMode('independent');
      } else {
        applyFocusMode('parentLinked');
      }
    };

    applyFocusMode(currentMode);

    // 7. 최소 크기(minWidth, minHeight) 감시
    if (options.minWidth || options.minHeight) {
      const minW = options.minWidth ?? 200;
      const minH = options.minHeight ?? 150;
      let resizeTimer: any = null;
      subWin.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (subWin && !subWin.closed) {
            const curW = subWin.outerWidth || subWin.innerWidth;
            const curH = subWin.outerHeight || subWin.innerHeight;
            if (curW < minW || curH < minH) {
              subWin.resizeTo(Math.max(curW, minW), Math.max(curH, minH));
            }
          }
        }, 100);
      });
    }

    // 8. 윈도우 핸들 인터페이스
    let userCleanup: (() => void) | void;
    let isDisposed = false;

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;

      if (parentFocusCleanup) {
        parentFocusCleanup();
        parentFocusCleanup = null;
      }
      if (subBlurCleanup) {
        subBlurCleanup();
        subBlurCleanup = null;
      }

      this.activeWindows.delete(fullId);

      if (typeof userCleanup === 'function') {
        try {
          userCleanup();
        } catch (e) {
          console.error('[SubWindowManager] 플러그인 cleanup 실행 오류:', e);
        }
      }
    };

    const handle: SubWindowHandle = {
      close: () => {
        if (subWin && !subWin.closed) {
          subWin.close();
        }
        dispose();
      },
      focus: () => {
        if (subWin && !subWin.closed) {
          subWin.focus();
        }
      },
      setTitle: (newTitle: string) => {
        if (subWin && !subWin.closed) {
          subDoc.title = newTitle;
          titleEl.textContent = newTitle;
        }
      },
      resize: (newW: number, newH: number) => {
        if (subWin && !subWin.closed) {
          subWin.resizeTo(Math.max(100, newW), Math.max(100, newH));
        }
      },
      setFocusMode: (mode) => {
        applyFocusMode(mode);
      },
      isOpen: () => {
        return Boolean(subWin && !subWin.closed);
      },
      getWindow: () => {
        return subWin && !subWin.closed ? subWin : null;
      },
    };

    // 사용자가 창의 [X]를 눌러 닫았을 때
    subWin.addEventListener('beforeunload', () => {
      dispose();
    });

    // 플러그인 deactivate 시 자동 정리에 등록
    if (onRegisterCleanup) {
      onRegisterCleanup(() => {
        handle.close();
      });
    }

    this.activeWindows.set(fullId, {
      subWin,
      handle,
      cleanup: dispose,
    });

    // 9. 사용자 render 함수 호출
    try {
      userCleanup = options.render(rootContainer, handle);
    } catch (e) {
      console.error('[SubWindowManager] 플러그인 render 함수 실행 오류:', e);
    }

    return handle;
  }

  /**
   * 열려 있는 모든 서브 윈도우를 안전하게 닫습니다.
   */
  closeAllWindows() {
    for (const [, item] of this.activeWindows) {
      if (item.subWin && !item.subWin.closed) {
        try {
          item.subWin.close();
        } catch {}
      }
      if (item.cleanup) {
        item.cleanup();
      }
    }
    this.activeWindows.clear();
  }
}

// 싱글톤 인스턴스
export const subWindowManager = new SubWindowManager();
