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
const STORAGE_MANUAL_TEXTURES = 'migoto_slot_manual_textures';

export class SlotManager {
  private resolvers: TextureSlotResolver[] = [];
  private manualMappings: Map<string, ModPartType> = new Map();
  private manualTextureMappings: Map<string, TextureSlot[]> = new Map();
  private detectedTextureFiles: string[] = [];
  private slots: ModelSlot[] = [];
  private unmatched: UnmatchedSection[] = [];
  private listeners = new Set<(slots: ModelSlot[]) => void>();
  private lastAnalysisTime = 0;
  private currentCwd: string | null = null;
  private docManager: DocumentManager | null = null;
  private explorer: FileExplorer | null = null;
  private lastDocs: Map<string, IniDocument> | null = null;
  private isAnalyzing = false;

  constructor() {
    // 기본 표준 3DMigoto 리졸버 등록
    this.registerTextureSlotResolver(standard3DMigotoResolver);
    this.loadManualMappings();
    this.loadManualTextureMappings();
  }

  /**
   * 워크스페이스 컨텍스트를 바인딩하여 UI 패널 개방 여부와 무관하게 백그라운드 자동 분석 보장
   */
  attachWorkspace(docManager: DocumentManager, explorer?: FileExplorer) {
    this.docManager = docManager;
    this.explorer = explorer || null;

    if (this.explorer) {
      this.explorer.onDidChangeFolder((folder) => {
        if (folder) {
          this.analyzeWorkspace(docManager, this.explorer || undefined);
        } else {
          this.clear();
        }
      });

      // 이미 열려 있는 폴더가 있는 경우 즉시 분석
      if (this.explorer.folder) {
        this.analyzeWorkspace(docManager, this.explorer);
      }
    }
  }

  /**
   * 플러그인 또는 코어 전용 텍스처 슬롯 리졸버를 등록합니다.
   * (새 리졸버 등록 시 기존 문서들을 즉시 재분석하여 슬롯을 자동 갱신합니다.)
   */
  registerTextureSlotResolver(resolver: TextureSlotResolver): () => void {
    const existingIdx = this.resolvers.findIndex((r) => r.id === resolver.id);
    if (existingIdx !== -1) {
      this.resolvers.splice(existingIdx, 1);
    }
    this.resolvers.push(resolver);
    this.resolvers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 리졸버가 등록/교체되면 기존 분석 문서들에 즉시 재적용
    this.reanalyzeIfPossible();

    return () => {
      const idx = this.resolvers.findIndex((r) => r.id === resolver.id);
      if (idx !== -1) {
        this.resolvers.splice(idx, 1);
        this.reanalyzeIfPossible();
      }
    };
  }

  /**
   * 기존 문서 캐시 또는 바인딩된 워크스페이스를 통해 슬롯을 즉시 재분석
   */
  reanalyzeIfPossible() {
    if (this.lastDocs && this.lastDocs.size > 0) {
      this.analyzeDocuments(this.lastDocs);
    } else if (this.docManager && !this.isAnalyzing) {
      this.analyzeWorkspace(this.docManager, this.explorer || undefined);
    }
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
   * INI 문서들에서 감지된 텍스처/이미지 파일명 목록을 반환합니다.
   */
  getDetectedTextureFiles(): string[] {
    return [...this.detectedTextureFiles];
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
   * 특정 섹션의 텍스처 슬롯 파일명을 수동 지정/수정합니다.
   */
  setTextureSlot(sectionName: string, slotId: string, textureFile: string, slotType?: any) {
    let slotsForSec = this.manualTextureMappings.get(sectionName);
    if (!slotsForSec) {
      const existing = this.slots.find((s) => s.sectionName === sectionName) ||
                       this.unmatched.find((u) => u.sectionName === sectionName);
      slotsForSec = existing ? existing.textureSlots.map((ts) => ({ ...ts })) : [];
      this.manualTextureMappings.set(sectionName, slotsForSec);
    }

    const idx = slotsForSec.findIndex((s) => s.slotId.toLowerCase() === slotId.toLowerCase());
    if (idx !== -1) {
      slotsForSec[idx].textureFile = textureFile;
      if (slotType) slotsForSec[idx].slotType = slotType;
      slotsForSec[idx].isManual = true;
    } else {
      slotsForSec.push({
        slotId,
        slotType: slotType || 'diffuse',
        textureFile,
        sourceSection: sectionName,
        isManual: true,
      });
    }

    this.saveManualTextureMappings();

    const targetModelSlot = this.slots.find((s) => s.sectionName === sectionName);
    if (targetModelSlot) {
      targetModelSlot.textureSlots = [...slotsForSec];
      this.emit();
    }
    const targetUnmatched = this.unmatched.find((u) => u.sectionName === sectionName);
    if (targetUnmatched) {
      targetUnmatched.textureSlots = [...slotsForSec];
      this.emit();
    }
  }

  /**
   * 특정 섹션의 텍스처 슬롯을 수동 삭제합니다.
   */
  removeTextureSlot(sectionName: string, slotId: string) {
    let slotsForSec = this.manualTextureMappings.get(sectionName);
    if (!slotsForSec) {
      const existing = this.slots.find((s) => s.sectionName === sectionName) ||
                       this.unmatched.find((u) => u.sectionName === sectionName);
      slotsForSec = existing ? existing.textureSlots.map((ts) => ({ ...ts })) : [];
      this.manualTextureMappings.set(sectionName, slotsForSec);
    }

    const idx = slotsForSec.findIndex((s) => s.slotId.toLowerCase() === slotId.toLowerCase());
    if (idx !== -1) {
      slotsForSec.splice(idx, 1);
    }
    this.saveManualTextureMappings();

    const targetModelSlot = this.slots.find((s) => s.sectionName === sectionName);
    if (targetModelSlot) {
      targetModelSlot.textureSlots = [...slotsForSec];
      this.emit();
    }
    const targetUnmatched = this.unmatched.find((u) => u.sectionName === sectionName);
    if (targetUnmatched) {
      targetUnmatched.textureSlots = [...slotsForSec];
      this.emit();
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
    if (this.isAnalyzing) {
      return {
        slots: [...this.slots],
        unmatched: [...this.unmatched],
        timestamp: this.lastAnalysisTime,
      };
    }
    this.isAnalyzing = true;
    try {
      this.docManager = docManager;
      if (explorer) this.explorer = explorer;
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
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 전달된 INI 문서 맵을 바탕으로 모델 및 텍스처 슬롯을 추출 및 매칭합니다.
   */
  analyzeDocuments(docs: Map<string, IniDocument>): SlotAnalysisResult {
    this.lastDocs = docs;
    const newSlots: ModelSlot[] = [];
    const newUnmatched: UnmatchedSection[] = [];

    // 0. INI 문서들 전체에서 정의/참조된 텍스처 및 이미지 파일명 수집
    const texFilesSet = new Set<string>();
    for (const iniDoc of docs.values()) {
      for (const section of iniDoc.sections) {
        // [Resource...] 섹션의 filename 프로퍼티 중 이미지 파일만 수집
        if (section.properties['filename']) {
          const fn = section.properties['filename'].replace(/['"]/g, '').trim();
          if (fn && /\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(fn)) {
            texFilesSet.add(fn);
          }
        }
        // 섹션 내 모든 프로퍼티에서 이미지 확장자 파일명 수집
        for (const val of Object.values(section.properties)) {
          const cleanVal = val.replace(/['"]/g, '').trim();
          if (/\.(dds|png|tga|jpg|jpeg|webp|bmp)$/i.test(cleanVal)) {
            texFilesSet.add(cleanVal);
          }
        }
      }
    }
    this.detectedTextureFiles = Array.from(texFilesSet).sort((a, b) => a.localeCompare(b));

    // 1. 모드 내 모델 섹션 수집 (ib = 구문이 있는 섹션만 모델로 파악)
    const candidates: Array<{ section: IniSection; filePath: string; doc: IniDocument }> = [];
    for (const [filePath, iniDoc] of docs.entries()) {
      for (const section of iniDoc.sections) {
        if (this.isModelSection(section)) {
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

      // 3. 텍스처 슬롯 추출 (사용자 수동 설정이 있으면 우선 반영, 없으면 리졸버 체인)
      const manualTextures = this.manualTextureMappings.get(section.name);
      const textureSlots = manualTextures && manualTextures.length > 0
        ? [...manualTextures]
        : this.resolveTextureSlotsForSection(section, iniDoc, docs);

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
   * 모델 섹션인지 검사합니다.
   * 사용자 요구사항: "모델은 ib = 구문이 있는 섹션이니 ib섹션만 파악해서 나타나도록 해야함"
   */
  private isModelSection(section: IniSection): boolean {
    const props = section.properties;
    return Boolean(props['ib'] || props['IB']);
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

  private loadManualTextureMappings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_MANUAL_TEXTURES);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) {
            this.manualTextureMappings.set(k, v as TextureSlot[]);
          }
        }
      }
    } catch {}
  }

  private saveManualTextureMappings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const obj: Record<string, TextureSlot[]> = {};
      for (const [k, v] of this.manualTextureMappings.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_MANUAL_TEXTURES, JSON.stringify(obj));
    } catch {}
  }
}

export const slotManager = new SlotManager();
