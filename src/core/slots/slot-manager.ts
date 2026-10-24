import { parseIni, type IniDocument, type IniSection } from '../ini/ini.ts';
import {
  detectPartFromSectionName,
  discoverModParts,
  formatPartLabel,
  PART_LABELS,
  standard3DMigotoResolver,
} from './resolver.ts';
import type {
  ModPartType,
  ModelSlot,
  SlotAnalysisResult,
  TextureSlot,
  TextureSlotResolver,
  UnmatchedSection,
} from './types.ts';
import type { DocumentManager } from '../workspace/documents.ts';
import type { FileExplorer } from '../../ui/panels/explorer.ts';
import { platform } from '../../platform/index.ts';
import { appLogger } from '../logger.ts';

const PART_SORT_ORDER: Record<string, number> = {
  head: 1,
  face: 2,
  hair: 3,
  body: 4,
  dress: 5,
  weapon: 6,
  extra: 7,
  custom: 8,
  unknown: 99,
};

const STORAGE_MANUAL_MAPPINGS = 'migoto_slot_manual_mappings';

export class SlotManager {
  private resolvers: TextureSlotResolver[] = [];
  private manualMappings: Map<string, ModPartType> = new Map();
  private slots: ModelSlot[] = [];
  private unmatched: UnmatchedSection[] = [];
  private listeners = new Set<(slots: ModelSlot[]) => void>();
  private lastAnalysisTime = 0;
  private currentCwd: string | null = null;

  constructor() {
    // 기본 표준 3DMigoto 리졸버 등록
    this.registerTextureSlotResolver(standard3DMigotoResolver);
    this.loadManualMappings();
  }

  /**
   * 플러그인 또는 코어 전용 텍스처 슬롯 리졸버를 등록합니다.
   * (우선순위 priority가 높은 리졸버가 먼저 실행됩니다.)
   */
  registerTextureSlotResolver(resolver: TextureSlotResolver): () => void {
    const existingIdx = this.resolvers.findIndex((r) => r.id === resolver.id);
    if (existingIdx !== -1) {
      this.resolvers.splice(existingIdx, 1);
    }
    this.resolvers.push(resolver);
    this.resolvers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    return () => {
      const idx = this.resolvers.findIndex((r) => r.id === resolver.id);
      if (idx !== -1) {
        this.resolvers.splice(idx, 1);
      }
    };
  }

  /**
   * 슬롯 갱신 이벤트 리스너를 등록합니다.
   */
  onDidChangeSlots(listener: (slots: ModelSlot[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 현재 분석된 슬롯 목록을 반환합니다.
   */
  getSlots(): ModelSlot[] {
    return [...this.slots];
  }

  /**
   * 특정 부위(head, body 등)의 모델/텍스처 슬롯을 조회합니다.
   */
  getSlot(part: ModPartType | string): ModelSlot | undefined {
    return this.slots.find((s) => s.part.toLowerCase() === part.toLowerCase());
  }

  /**
   * 부위 판단이 서지 않은 미분류 섹션 목록을 반환합니다.
   */
  getUnmatched(): UnmatchedSection[] {
    return [...this.unmatched];
  }

  /**
   * 특정 섹션을 특정 부위로 수동 매칭/지정합니다.
   */
  setPartMapping(sectionName: string, part: ModPartType | string) {
    const targetPart = part as ModPartType;
    this.manualMappings.set(sectionName, targetPart);
    this.saveManualMappings();

    // 기존 unmatched에서 해당 섹션이 있다면 slots로 승격
    const unIdx = this.unmatched.findIndex((u) => u.sectionName === sectionName);
    if (unIdx !== -1) {
      const item = this.unmatched[unIdx];
      this.unmatched.splice(unIdx, 1);

      this.slots.push({
        part: targetPart,
        partName: formatPartLabel(targetPart),
        sectionName: item.sectionName,
        filePath: item.filePath,
        startLine: item.startLine,
        ib: item.ib,
        hash: item.hash,
        textureSlots: item.textureSlots,
        isManual: true,
      });

      this.sortSlots();
      this.emit();
    } else {
      // 기존 slot 중 해당 섹션이 있다면 part 재지정
      const existing = this.slots.find((s) => s.sectionName === sectionName);
      if (existing) {
        existing.part = targetPart;
        existing.partName = formatPartLabel(targetPart);
        existing.isManual = true;
        this.sortSlots();
        this.emit();
      }
    }
  }

  /**
   * 수동 매칭을 초기화하고 자동 추정으로 되돌립니다.
   */
  removePartMapping(sectionName: string) {
    this.manualMappings.delete(sectionName);
    this.saveManualMappings();
  }

  /**
   * 열려 있는 작업 폴더 또는 현재 문서를 바탕으로 슬롯을 완전 분석합니다.
   */
  async analyzeWorkspace(docManager: DocumentManager, explorer?: FileExplorer): Promise<SlotAnalysisResult> {
    const docs = new Map<string, IniDocument>();
    const activeFile = docManager.file;
    const currentFolder = explorer?.folderPath ?? null;
    this.currentCwd = currentFolder;

    // 1. 작업 폴더가 열려 있는 경우 폴더 내 모든 INI 파일 탐색
    if (currentFolder && platform().readDirectory) {
      try {
        const entries = await platform().readDirectory(currentFolder);
        const iniPaths: string[] = [];

        const traverse = (items: any[]) => {
          for (const item of items) {
            if (item.isDir || item.isDirectory) {
              if (item.children && Array.isArray(item.children)) {
                traverse(item.children);
              }
            } else if (item.name?.toLowerCase().endsWith('.ini')) {
              iniPaths.push(item.id || item.path);
            }
          }
        };
        traverse(entries);

        for (const iniPath of iniPaths) {
          try {
            const ref = platform().refFromId(iniPath);
            const loaded = await platform().readFile(ref);
            if (loaded && loaded.text) {
              docs.set(iniPath, parseIni(loaded.text));
            }
          } catch {}
        }
      } catch (err) {
        appLogger.warn('Slots', '작업 폴더 INI 탐색 중 오류 발생', err);
      }
    }

    // 2. 열려 있는 활성 탭이 있고 위 목록에 없다면(또는 단일 파일 모드라면) 추가
    if (activeFile && docManager.activeTab?.kind === 'text') {
      const activeText = docManager.activeTab.model.getValue();
      docs.set(activeFile.id, parseIni(activeText));
    } else if (docs.size === 0 && docManager.activeTab?.kind === 'text') {
      const activeText = docManager.activeTab.model.getValue();
      docs.set('current.ini', parseIni(activeText));
    }

    return this.analyzeDocuments(docs);
  }

  /**
   * 전달된 INI 문서 맵을 바탕으로 모델 및 텍스처 슬롯을 추출 및 매칭합니다.
   */
  analyzeDocuments(docs: Map<string, IniDocument>): SlotAnalysisResult {
    const newSlots: ModelSlot[] = [];
    const newUnmatched: UnmatchedSection[] = [];

    // 1. 모드 내 모든 후보 오버라이드 섹션 수집
    const candidates: Array<{ section: IniSection; filePath: string; doc: IniDocument }> = [];
    for (const [filePath, iniDoc] of docs.entries()) {
      for (const section of iniDoc.sections) {
        if (this.isModelOrOverrideSection(section)) {
          candidates.push({ section, filePath, doc: iniDoc });
        }
      }
    }

    // 2. 모드 INI 전체 섹션명을 바탕으로 동적 부위 자동 도출
    const sectionNames = candidates.map((c) => c.section.name);
    const discoveredParts = discoverModParts(sectionNames);

    for (const { section, filePath, doc: iniDoc } of candidates) {
      // 1. 부위(Part) 판별 (수동 오버라이드 확인 -> 모드 동적 분석 -> 단일 섹션 fallback)
      const manualPart = this.manualMappings.get(section.name);
      const dynamicPart = discoveredParts.get(section.name) || detectPartFromSectionName(section.name);
      const detectedPart = manualPart ?? dynamicPart;

      // 2. 모델 슬롯 정보 추출
      const props = section.properties;
      const ib = props['ib']?.replace(/^ref\s+/i, '').trim();
      const vb = props['vb']?.replace(/^ref\s+/i, '').trim();
      const hash = props['hash'];
      const matchFirstIndex = props['match_first_index'] ? parseInt(props['match_first_index'], 10) : undefined;
      const drawIndexed = props['drawindexed'];
      const handling = props['handling'];

      // 3. 텍스처 슬롯 추출 (등록된 리졸버들을 우선순위순으로 실행)
      const textureSlots = this.resolveTextureSlotsForSection(section, iniDoc, docs);

      // 4. 슬롯 분류 할당
      if (detectedPart && detectedPart.toLowerCase() !== 'unknown') {
        newSlots.push({
          part: detectedPart,
          partName: formatPartLabel(detectedPart),
          sectionName: section.name,
          filePath,
          startLine: section.startLine,
          ib,
          vb,
          hash,
          matchFirstIndex,
          drawIndexed,
          handling,
          textureSlots,
          isManual: Boolean(manualPart),
        });
      } else {
        newUnmatched.push({
          sectionName: section.name,
          filePath,
          startLine: section.startLine,
          ib,
          hash,
          textureSlots,
        });
      }
    }

    this.slots = newSlots;
    this.unmatched = newUnmatched;
    this.sortSlots();
    this.lastAnalysisTime = Date.now();

    this.emit();

    return {
      slots: [...this.slots],
      unmatched: [...this.unmatched],
      timestamp: this.lastAnalysisTime,
    };
  }

  /**
   * 해당 섹션의 텍스처 슬롯을 리졸버 체인을 통해 수집합니다.
   */
  private resolveTextureSlotsForSection(
    section: IniSection,
    doc: IniDocument,
    allDocs: Map<string, IniDocument>,
  ): TextureSlot[] {
    const collected: TextureSlot[] = [];
    const seenSlots = new Set<string>();

    for (const resolver of this.resolvers) {
      try {
        const slots = resolver.resolveSlots(section, doc, allDocs);
        if (slots && Array.isArray(slots)) {
          for (const s of slots) {
            const key = `${s.slotId.toLowerCase()}:${s.resourceRef || ''}`;
            if (!seenSlots.has(key)) {
              seenSlots.add(key);
              collected.push(s);
            }
          }
        }
      } catch (err) {
        console.warn(`[SlotManager] resolver "${resolver.id}" error:`, err);
      }
    }

    return collected;
  }

  /**
   * 모델 또는 텍스처 오버라이드 섹션인지 검사합니다.
   */
  private isModelOrOverrideSection(section: IniSection): boolean {
    const name = section.name.toLowerCase();
    if (name.startsWith('textureoverride') || name.startsWith('shaderoverride')) {
      return true;
    }
    const props = section.properties;
    // ib, hash, match_first_index, drawindexed 등의 속성이 있는 경우
    if (props['ib'] || props['vb'] || props['hash'] || props['match_first_index'] || props['drawindexed']) {
      return true;
    }
    return false;
  }

  private sortSlots() {
    this.slots.sort((a, b) => {
      const orderA = PART_SORT_ORDER[a.part.toLowerCase()] ?? 50;
      const orderB = PART_SORT_ORDER[b.part.toLowerCase()] ?? 50;
      if (orderA !== orderB) return orderA - orderB;
      return a.part.localeCompare(b.part) || a.sectionName.localeCompare(b.sectionName);
    });
  }

  private emit() {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.slots]);
      } catch (err) {
        console.warn('[SlotManager] listener error:', err);
      }
    });
  }

  clear() {
    this.slots = [];
    this.unmatched = [];
    this.emit();
  }

  private loadManualMappings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_MANUAL_MAPPINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.manualMappings.set(k, v as ModPartType);
        }
      }
    } catch {}
  }

  private saveManualMappings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const obj: Record<string, string> = {};
      for (const [k, v] of this.manualMappings.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_MANUAL_MAPPINGS, JSON.stringify(obj));
    } catch {}
  }
}

export const slotManager = new SlotManager();
