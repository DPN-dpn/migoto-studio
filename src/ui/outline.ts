import type { monaco } from '../core/monaco.ts';
import type { DocumentManager } from '../core/documents.ts';

interface Section { name: string; line: number; group: string }

/** Section-name prefix -> group shown in the panel (first match wins, case-insensitive). */
const GROUPS: [RegExp, string][] = [
  [/^key/i, '키 (단축키)'],
  [/^textureoverride/i, '텍스처 오버라이드'],
  [/^shaderoverride/i, '셰이더 오버라이드'],
  [/^shaderregex/i, '셰이더 정규식'],
  [/^resource/i, '리소스'],
  [/^commandlist/i, '커맨드 리스트'],
  [/^(constants|present|include|logging|system|device|rendering|hunting|profile|loader|stereo|convergence|depth|cursor|dummy|ini)/i, '일반 설정'],
];

function groupOf(name: string) {
  return GROUPS.find(([re]) => re.test(name))?.[1] ?? '기타';
}

/** Collects `[Section]` header lines. Commented-out lines (`;`) are not sections. */
export function parseSections(model: monaco.editor.ITextModel): Section[] {
  const out: Section[] = [];
  const re = /^\s*\[([^\]\r\n]+)\]/;
  for (let line = 1; line <= model.getLineCount(); line++) {
    const m = re.exec(model.getLineContent(line));
    if (m) out.push({ name: m[1].trim(), line, group: groupOf(m[1].trim()) });
  }
  return out;
}

const DEFAULT_WIDTH = 250;
const MIN_WIDTH = 160;
const MAX_WIDTH = 650;
const MIN_EDITOR_WIDTH = 240;
const STORAGE_KEY = 'migoto_sidebar_width';

/** Left-hand section list: grouped, searchable, click to jump, follows the cursor, resizable split panel. */
export class OutlinePanel {
  private sections: Section[] = [];
  private filter = '';
  private activeLine = 0;
  private timer = 0;
  private currentWidth = DEFAULT_WIDTH;
  private readonly list: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly docTitle: HTMLElement;
  private readonly closedGroups = new Set<string>();
  private readonly editor: monaco.editor.IStandaloneCodeEditor;
  private readonly doc?: DocumentManager;
  private readonly root: HTMLElement;
  private readonly contentRoot: HTMLElement;
  private readonly resizer?: HTMLElement | null;

  constructor(
    editor: monaco.editor.IStandaloneCodeEditor,
    doc: DocumentManager,
    root: HTMLElement,
    contentRoot?: HTMLElement,
    resizer?: HTMLElement | null,
  );
  constructor(
    editor: monaco.editor.IStandaloneCodeEditor,
    root: HTMLElement,
    contentRoot?: HTMLElement,
    resizer?: HTMLElement | null,
  );
  constructor(
    editor: monaco.editor.IStandaloneCodeEditor,
    docOrRoot: DocumentManager | HTMLElement,
    rootOrContent?: HTMLElement,
    contentOrResizer?: HTMLElement | null,
    resizer?: HTMLElement | null,
  ) {
    this.editor = editor;
    if ('activeTab' in (docOrRoot as any) || 'allTabs' in (docOrRoot as any)) {
      this.doc = docOrRoot as DocumentManager;
      this.root = rootOrContent!;
      this.contentRoot = (contentOrResizer as HTMLElement) || this.root;
      this.resizer = resizer;
    } else {
      this.root = docOrRoot as HTMLElement;
      this.contentRoot = rootOrContent || this.root;
      this.resizer = contentOrResizer;
    }

    this.contentRoot.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'outline-header';

    const title = document.createElement('h2');
    title.textContent = '섹션 목록';

    this.docTitle = document.createElement('span');
    this.docTitle.className = 'outline-doc-info';

    header.append(title, this.docTitle);

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.placeholder = '섹션 검색…';
    this.searchInput.setAttribute('aria-label', '섹션 검색');
    this.searchInput.addEventListener('input', () => {
      this.filter = this.searchInput.value.trim().toLowerCase();
      this.render();
    });

    this.list = document.createElement('div');
    this.list.className = 'outline-list';
    this.contentRoot.append(header, this.searchInput, this.list);

    // Restore saved width
    const savedWidth = Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_WIDTH;
    this.applyWidth(savedWidth);
    requestAnimationFrame(() => this.layoutEditor());

    if (this.resizer) {
      this.setupResizer(this.resizer);
    }

    const refresh = () => {
      if (this.doc) {
        const activeTab = this.doc.activeTab;
        if (!activeTab || activeTab.kind !== 'text') {
          this.sections = [];
        } else {
          this.sections = parseSections(activeTab.model);
        }
      } else {
        const model = this.editor.getModel();
        this.sections = model ? parseSections(model) : [];
      }
      this.render();
    };

    // 1. 활성 탭 전환 및 문서 상태 변경 시
    if (this.doc) {
      this.doc.onChange(() => {
        refresh();
        if (this.doc?.activeTab?.kind === 'text') {
          this.setActive(this.editor.getPosition()?.lineNumber ?? 1);
        }
      });
    }

    // 2. 현재 활성 텍스트 모델 편집 시
    editor.onDidChangeModelContent(() => {
      if (this.doc && this.doc.activeTab?.kind !== 'text') return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(refresh, 250);
    });

    // 3. 에디터 모델 변경 시 (doc 없을 때의 fallback 호환)
    editor.onDidChangeModel(() => {
      if (!this.doc) {
        refresh();
        this.setActive(editor.getPosition()?.lineNumber ?? 1);
      }
    });

    // 4. 에디터 커서 이동 시
    editor.onDidChangeCursorPosition((e) => {
      if (this.doc && this.doc.activeTab?.kind !== 'text') return;
      this.setActive(e.position.lineNumber);
    });

    refresh();
    if (!this.doc || this.doc.activeTab?.kind === 'text') {
      this.setActive(editor.getPosition()?.lineNumber ?? 1);
    }
  }

  setVisible(visible: boolean) {
    this.root.hidden = !visible;
    if (this.resizer) this.resizer.hidden = !visible;
    this.layoutEditor();
  }

  private layoutEditor() {
    const workspace = this.root.parentElement;
    if (!workspace) {
      this.editor.layout();
      return;
    }
    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;
    const tabbarContainer = document.getElementById('tabbar-container');
    const tabbarHeight = tabbarContainer ? tabbarContainer.offsetHeight : 0;
    const editorHeight = Math.max(0, workspaceHeight - tabbarHeight);

    const activityBar = document.getElementById('activity-bar');
    const activityBarWidth = activityBar && !activityBar.hidden ? activityBar.offsetWidth : 0;

    if (this.root.hidden) {
      this.editor.layout({ width: Math.max(MIN_EDITOR_WIDTH, workspaceWidth - activityBarWidth), height: editorHeight });
    } else {
      const resizerWidth = this.resizer && !this.resizer.hidden ? this.resizer.offsetWidth : 0;
      const sidebarWidth = this.root.offsetWidth || this.currentWidth;
      const editorWidth = Math.max(MIN_EDITOR_WIDTH, workspaceWidth - activityBarWidth - sidebarWidth - resizerWidth);
      this.editor.layout({ width: editorWidth, height: editorHeight });
    }
  }

  private applyWidth(width: number) {
    const workspace = this.root.parentElement;
    const workspaceWidth = workspace ? workspace.clientWidth : window.innerWidth;
    const workspaceHeight = workspace ? workspace.clientHeight : window.innerHeight;
    const tabbarContainer = document.getElementById('tabbar-container');
    const tabbarHeight = tabbarContainer ? tabbarContainer.offsetHeight : 0;
    const editorHeight = Math.max(0, workspaceHeight - tabbarHeight);
    const resizerWidth = this.resizer && !this.resizer.hidden ? this.resizer.offsetWidth : 0;
    const activityBar = document.getElementById('activity-bar');
    const activityBarWidth = activityBar && !activityBar.hidden ? activityBar.offsetWidth : 0;
    const maxAllowed = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, workspaceWidth - activityBarWidth - MIN_EDITOR_WIDTH - resizerWidth));
    const clamped = Math.max(MIN_WIDTH, Math.min(width, maxAllowed));

    this.currentWidth = clamped;
    this.root.style.width = `${clamped}px`;
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}

    const editorWidth = Math.max(MIN_EDITOR_WIDTH, workspaceWidth - activityBarWidth - clamped - resizerWidth);
    this.editor.layout({ width: editorWidth, height: editorHeight });
  }

  private setupResizer(resizer: HTMLElement) {
    const onMouseMove = (e: MouseEvent) => {
      const sidebarRect = this.root.getBoundingClientRect();
      const targetWidth = e.clientX - sidebarRect.left;
      this.applyWidth(targetWidth);
    };

    const onMouseUp = () => {
      document.body.classList.remove('resizing');
      resizer.classList.remove('dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.layoutEditor();
    };

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.classList.add('resizing');
      resizer.classList.add('dragging');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    resizer.addEventListener('dblclick', () => {
      this.applyWidth(DEFAULT_WIDTH);
    });

    window.addEventListener('resize', () => {
      if (!this.root.hidden) {
        this.applyWidth(this.currentWidth);
      } else {
        this.layoutEditor();
      }
    });
  }

  private setActive(cursorLine: number) {
    if (this.doc && this.doc.activeTab?.kind !== 'text') {
      this.activeLine = 0;
      return;
    }
    let active = 0;
    for (const s of this.sections) if (s.line <= cursorLine) active = s.line;
    if (active === this.activeLine) return;
    this.activeLine = active;
    this.list.querySelectorAll('.outline-item').forEach((el) => {
      const on = Number((el as HTMLElement).dataset.line) === active;
      el.classList.toggle('active', on);
      if (on) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
  }

  private jump(line: number) {
    if (this.doc && this.doc.activeTab?.kind !== 'text') return;
    this.editor.revealLineNearTop(line);
    this.editor.setPosition({ lineNumber: line, column: 1 });
    this.editor.focus();
  }

  private render() {
    this.list.replaceChildren();

    if (this.doc) {
      const activeTab = this.doc.activeTab;
      if (!activeTab) {
        this.docTitle.textContent = '';
        this.docTitle.hidden = true;
        this.searchInput.disabled = true;
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = '열린 문서가 없습니다.';
        this.list.append(p);
        return;
      }

      this.docTitle.textContent = activeTab.title;
      this.docTitle.hidden = false;

      if (activeTab.kind === 'custom') {
        this.searchInput.disabled = true;
        this.searchInput.value = '';
        this.filter = '';
        const p = document.createElement('p');
        p.className = 'hint outline-notice';
        p.textContent = `현재 보고 있는 탭('${activeTab.title}')은 에셋 뷰어입니다. (섹션 목록 없음)`;
        this.list.append(p);
        return;
      }

      if (activeTab.kind === 'diff') {
        this.searchInput.disabled = true;
        this.searchInput.value = '';
        this.filter = '';
        const p = document.createElement('p');
        p.className = 'hint outline-notice';
        p.textContent = '현재 보고 있는 탭은 파일 비교(Diff) 뷰어입니다.';
        this.list.append(p);
        return;
      }

      this.searchInput.disabled = false;
    } else {
      this.docTitle.textContent = '';
      this.docTitle.hidden = true;
      this.searchInput.disabled = false;
    }

    const visible = this.sections.filter((s) => s.name.toLowerCase().includes(this.filter));
    if (visible.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = this.sections.length ? '일치하는 섹션이 없습니다.' : '[섹션]이 아직 없습니다.';
      this.list.append(p);
      return;
    }
    const byGroup = new Map<string, Section[]>();
    for (const s of visible) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]);

    for (const [group, items] of byGroup) {
      const details = document.createElement('details');
      details.open = this.filter !== '' || !this.closedGroups.has(group);
      details.addEventListener('toggle', () => {
        if (this.filter) return;
        if (details.open) this.closedGroups.delete(group); else this.closedGroups.add(group);
      });
      const summary = document.createElement('summary');
      summary.textContent = `${group} (${items.length})`;
      details.append(summary);
      for (const s of items) {
        const b = document.createElement('button');
        b.className = 'outline-item' + (s.line === this.activeLine ? ' active' : '');
        b.dataset.line = String(s.line);
        b.title = `${s.name}  (줄 ${s.line})`;
        b.textContent = s.name;
        b.addEventListener('click', () => this.jump(s.line));
        details.append(b);
      }
      this.list.append(details);
    }
  }
}
