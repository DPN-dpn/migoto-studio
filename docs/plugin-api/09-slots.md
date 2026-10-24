# 09. 3D 모델 및 텍스처 슬롯 매칭 API (`context.slots`)

Migoto Studio 코어의 **모델 및 텍스처 슬롯 매칭 엔진**과 상호작용하기 위한 API입니다.  
열려 있는 모드 폴더의 INI 구조를 기반으로 머리, 몸체, 의상, 헤어, 무기 등의 부위를 자동 판별하고, 각 부위에 연결된 텍스처 슬롯(Diffuse, Normal, LightMap 등)을 추적합니다.

판별이 서지 않은 섹션은 사용자가 사이드바 **슬롯 매칭 패널**에서 수동으로 부위를 지정할 수 있으며, 플러그인에서는 `context.slots`를 통해 항상 최신의 매칭 슬롯 정보를 가져다 사용할 수 있습니다.

---

## 1. 슬롯 조회 및 변경 감지

### `context.slots.getSlots()`
현재 분석/매칭된 모든 부위의 모델 및 텍스처 슬롯 목록을 반환합니다.

```typescript
const slots = context.slots.getSlots();

for (const slot of slots) {
  context.logger.info(`[${slot.part}] 섹션: ${slot.sectionName}, 텍스처 ${slot.textureSlots.length}개`);
  for (const tex of slot.textureSlots) {
    context.logger.info(`  - ${tex.slotId} (${tex.slotType}): ${tex.textureFile || tex.resourceRef}`);
  }
}
```

### `context.slots.getSlot(part)`
특정 부위(`'head'`, `'body'`, `'dress'`, `'hair'`, `'face'`, `'weapon'`, `'extra'`, `'custom'`)에 매칭된 모델 슬롯을 조회합니다.

```typescript
const bodySlot = context.slots.getSlot('body');
if (bodySlot) {
  context.logger.info(`몸체 IB: ${bodySlot.ib}, 해시: ${bodySlot.hash}`);
}
```

### `context.slots.onDidChangeSlots(listener)`
사용자가 슬롯 매칭 패널에서 부위를 수동 변경하거나 파일 저장 등으로 슬롯 분석이 갱신되었을 때 호출되는 리스너를 등록합니다.  
플러그인 비활성화 시 자동으로 리스너가 해제됩니다.

```typescript
const unlisten = context.slots.onDidChangeSlots((slots) => {
  context.logger.info(`슬롯 정보가 갱신되었습니다: 총 ${slots.length}개 부위`);
});
```

### `context.slots.refreshSlots()`
작업 영역 및 열린 INI 파일들을 즉시 재분석하여 최신 슬롯 목록을 반환합니다.

```typescript
const updatedSlots = await context.slots.refreshSlots();
```

### `context.slots.setPartMapping(sectionName, part)`
특정 섹션을 특정 부위로 수동 지정/매칭합니다. (사용자 UI의 수동 매칭 동작과 동일)

```typescript
context.slots.setPartMapping('TextureOverrideCustomDressA', 'dress');
```

---

## 2. 커스텀 텍스처 슬롯 리졸버 등록

### `context.slots.registerTextureSlotResolver(resolver)`
표준 3DMigoto 구문(`ps-t0`, `diffuse = ...`) 외에 게임/엔진별 독자적인 텍스처 입력 구문(예: ZZMI SlotFix, 커스텀 셰이더 슬롯 등)을 해석하기 위한 커스텀 리졸버를 등록합니다.

- `priority`: 우선순위 (숫자가 클수록 표준 3DMigoto 리졸버(기본값 0)보다 먼저 실행됩니다.)
- 플러그인 비활성화 시 자동으로 리졸버가 해제됩니다.

```typescript
// 예: ZZMI SlotFix (Resource\ZZMI\Diffuse = ref ...) 리졸버 등록
context.slots.registerTextureSlotResolver({
  id: 'my-slot-resolver',
  name: '커스텀 슬롯픽스 리졸버',
  priority: 10,
  resolveSlots: (section, doc, allDocs) => {
    const slots = [];
    const props = section.properties;

    for (const [key, rawVal] of Object.entries(props)) {
      const match = key.match(/^Resource\\ZZMI\\(.+)$/i);
      if (match) {
        const slotName = match[1];
        slots.push({
          slotId: `ZZMI\\${slotName}`,
          slotType: slotName.toLowerCase().includes('diffuse') ? 'diffuse' : 'custom',
          resourceRef: rawVal.replace(/^ref\s+/i, '').trim(),
          sourceSection: section.name,
        });
      }
    }

    return slots.length > 0 ? slots : null;
  },
});
```

---

## 3. 주요 데이터 타입 정의

```typescript
export type ModPartType =
  | 'head'
  | 'body'
  | 'dress'
  | 'hair'
  | 'face'
  | 'weapon'
  | 'extra'
  | 'custom'
  | 'unknown';

export type TextureSlotType = 'diffuse' | 'normal' | 'light' | 'material' | 'fx' | 'custom';

export interface TextureSlot {
  slotId: string;             // 슬롯 식별자 (예: 'Diffuse', 'ps-t0', 'ZZMI\\Diffuse')
  slotType: TextureSlotType;  // 텍스처 종류 ('diffuse' | 'normal' | 'light' | 'material' | 'fx' | 'custom')
  resourceRef?: string;       // 참조 리소스명 (예: 'ResourceRoxyBodyDiffuse')
  textureFile?: string;       // [Resource...] 섹션에서 조회된 실제 파일명 (예: 'Body_D.dds')
  rawLine?: string;           // 원본 프로퍼티 라인 문자열
  sourceSection?: string;     // 정의된 섹션명
}

export interface ModelSlot {
  part: ModPartType;          // 부위 분류
  partName: string;           // 부위 레이블 (예: '몸체 (Body)')
  sectionName: string;        // INI 섹션명 (예: 'TextureOverrideBody')
  filePath: string;           // 파일 경로
  startLine?: number;         // 시작 줄 번호
  ib?: string;                // 인덱스 버퍼 리소스
  vb?: string;                // 버텍스 버퍼 리소스
  hash?: string;              // 해시값
  matchFirstIndex?: number;   // match_first_index
  drawIndexed?: string;       // drawindexed
  handling?: string;          // handling
  textureSlots: TextureSlot[];// 연결된 텍스처 슬롯 목록
  isManual?: boolean;         // 수동 매칭 여부
}
```
