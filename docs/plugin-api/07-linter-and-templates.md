# 린터 및 코드 템플릿 확장 API (`context.linter`, `context.templates`)


Migoto Studio의 코어 린터 및 코드 템플릿 제안을 플러그인에서 동적으로 확장할 수 있습니다.

### 9.1 허용 리소스 및 변수 화이트리스트 등록 (`context.linter`)

특정 게임 프레임워크(ZZMI, GIMI 등)나 전용 라이브러리(TTL 등)에서 사용되는 고유 커맨드리스트, 슬롯 리소스, 변수를 등록하여 미정의 오류/경고 없이 정상 문법으로 인식하도록 합니다.
문자열, 정규식, 또는 콜백 함수(`(name: string) => boolean`)를 전달할 수 있으며, 반환되는 정리 함수(`() => void`)를 호출하면 등록이 해제됩니다.

```typescript
// 1. 특정 커맨드리스트 및 리소스 허용
context.linter.registerAllowedResource('CommandList\\ZZMI\\SetTextures');
context.linter.registerAllowedResource(/^commandlist\\ttl\\/i);
context.linter.registerAllowedResource(/^resource\\ttl\\/i);

// 2. 전용 변수 허용 ($\TTL\alpha, $\TTL\_1 등)
context.linter.registerAllowedVariable((name: string) => {
  const norm = name.toLowerCase().replace(/^[\\$]+/, '');
  return norm.startsWith('ttl\\');
});
context.linter.registerAllowedVariable(/^\\?ttl\\/i);

// 3. 미사용(Unused) 경고 방지 등록
context.linter.registerAllowedUsedVariable(/^\\?ttl\\/i);
context.linter.registerAllowedUsedResource(/^resource\\ttl\\/i);
```

### 9.2 커스텀 린트 규칙 등록 (`context.linter.registerRule`)

에디터 검사 시 실시간으로 실행될 커스텀 린트 검사 로직을 추가합니다:

```typescript
context.linter.registerRule({
  id: 'my-custom-check',
  name: '모드 리소스 무결성 검사',
  run: (iniDoc, ctx) => {
    const diagnostics = [];
    // 검사 로직 작성 후 Diagnostic 객체 반환
    return diagnostics;
  },
});
```

### 9.3 사후 진단 필터링 및 보정 (`context.linter.registerDiagnosticFilter`)

플러그인 간의 **완전한 상호 독립성**을 유지하면서 도메인별 특수 문법을 유연하게 보정하기 위해, 린터 실행 파이프라인의 최종 단계에서 진단 마커를 필터링하는 API입니다.

예를 들어, 범용 XXMI 린터(`custom-lint`)는 모드 폴더 내 `namespace = TTL` 선언이 없으면 독립적으로 네임스페이스 부재 경고를 발생시킵니다. 이때 도메인 전용 플러그인(`zzmi-support`)은 `custom-lint`에 직접 결합되지 않고, `registerDiagnosticFilter`를 등록하여 해당 경고가 ZZMI 표준 내장 라이브러리(TTL 등)에 부합하는 경우 사후에 이를 가로채어 정상 코드로 보정(억제)합니다.

```typescript
const unregister = context.linter.registerDiagnosticFilter((diag, ctx) => {
  const msg = diag.message || '';

  // TTL 관련 네임스페이스 경고나 미선언 변수 경고를 정상 코드로 보정하여 억제
  if (msg.includes("'TTL'") || msg.includes("'ttl'")) {
    return false; // false를 반환하면 진단 마커가 제거됩니다.
  }
  if (/\bttl[\\_]/i.test(msg) || /\$?\\?ttl\\/i.test(msg)) {
    return false;
  }

  // 그 외 일반 경고는 유지
  return true;
});

// 필요 시 등록 해제
// unregister();
```

- **파라미터**:
  - `diag`: Monaco 진단 마커 객체 (`message`, `startLineNumber`, `startColumn`, `endLineNumber`, `endColumn`, `severity`)
  - `ctx`: 검사 컨텍스트 (`model`: 현재 에디터 텍스트 모델)
- **반환값**: `boolean` (`true`: 마커 유지, `false`: 마커 억제/제거)
- **생명주기**: 플러그인이 언로드되거나 비활성화될 때 자동으로 정리됩니다.

### 9.4 커스텀 코드 템플릿 등록 (`context.templates.registerTemplate`)

Monaco 에디터에서 `[` 입력 시 노출되는 인라인 자동완성 템플릿 또는 템플릿 패널에 새 코드 스니펫을 등록합니다:

```typescript
context.templates.registerTemplate({
  id: 'zzmi_ttl_draw',
  title: 'ZZMI TTL 투명도 드로우 (단일 투명도)',
  description: '텍스처 없이 지정한 알파 값으로 반투명을 렌더링하는 TTL 기본 드로우 구문',
  category: 'zzmi',
  snippet: [
    '; --- ZZMI TTL Transparency Draw ---',
    '$\\TTL\\alpha = ${1:0.5}',
    'run = CommandList\\TTL\\Draw',
  ].join('\n'),
});
```

---
