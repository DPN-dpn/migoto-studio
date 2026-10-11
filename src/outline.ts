import { monaco } from './monaco';

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
  private readonly closedGroups = new Set<string>();

  constructor(
    private editor: monaco.editor.IStandaloneCodeEditor,
    private root: HTMLElement,
    private resizer?: HTMLElement | null,
  ) {
    root.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = '섹션 목록';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = '섹션 검색…';
    search.setAttribute('aria-label', '섹션 검색');
    search.addEventListener('input', () => { this.filter = search.value.trim().toLowerCase(); this.render(); });
    this.list = document.createElement('div');
    this.list.className = 'outline-list';
    root.append(title, search, this.list);

    // Restore saved width
    const savedWidth = Number(localStorage.getItem(STORAGE_KEY)) || DEFAULT_WIDTH;
    this.applyWidth(savedWidth);
    requestAnimationFrame(() => this.layoutEditor());

    if (this.resizer) {
      this.setupResizer(this.resizer);
    }

    const model = () => editor.getModel()!;
    const refresh = () => { this.sections = parseSections(model()); this.render(); };
    editor.onDidChangeModelContent(() => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(refresh, 250);
    });
    editor.onDidChangeModel(() => {
      refresh();
      this.setActive(editor.getPosition()?.lineNumber ?? 1);
    });
    editor.onDidChangeCursorPosition((e) => this.setActive(e.position.lineNumber));
    refresh();
    this.setActive(editor.getPosition()?.lineNumber ?? 1);
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

    if (this.root.hidden) {
      this.editor.layout({ width: workspaceWidth, height: editorHeight });
    } else {
      const resizerWidth = this.resizer && !this.resizer.hidden ? this.resizer.offsetWidth : 0;
      const sidebarWidth = this.root.offsetWidth || this.currentWidth;
      const editorWidth = Math.max(MIN_EDITOR_WIDTH, workspaceWidth - sidebarWidth - resizerWidth);
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
    const maxAllowed = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, workspaceWidth - MIN_EDITOR_WIDTH - resizerWidth));
    const clamped = Math.max(MIN_WIDTH, Math.min(width, maxAllowed));

    this.currentWidth = clamped;
    this.root.style.width = `${clamped}px`;
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}

    const editorWidth = Math.max(MIN_EDITOR_WIDTH, workspaceWidth - clamped - resizerWidth);
    this.editor.layout({ width: editorWidth, height: editorHeight });
  }

  private setupResizer(resizer: HTMLElement) {
    const onMouseMove = (e: MouseEvent) => {
      const workspace = this.root.parentElement;
      if (!workspace) return;
      const workspaceRect = workspace.getBoundingClientRect();
      const targetWidth = e.clientX - workspaceRect.left;
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
    this.editor.revealLineNearTop(line);
    this.editor.setPosition({ lineNumber: line, column: 1 });
    this.editor.focus();
  }

  private render() {
    this.list.replaceChildren();
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
