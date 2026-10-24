# 스토리지, 시스템 실행 및 로거 API (`context.storage`, `context.system`, `context.logger`)


플러그인별로 격리된 `localStorage` 저장 공간을 제공합니다.

```typescript
// 설정값 가져오기 (기본값 지원)
const apiKey = context.storage.get('apiKey', '');
const config = context.storage.get('userConfig', { mode: 'fast' });

// 설정값 저장하기
context.storage.set('apiKey', 'sk-...');
context.storage.set('userConfig', { mode: 'precise' });
```

---

## 8. 시스템 프로세스 실행 (`context.system` - 데스크톱 전용)

데스크톱 앱 환경에서 외부 유틸리티나 도구를 실행할 수 있습니다.

```typescript
// command, args, cwd(선택), stdin(선택)
const result = await context.system.exec('python', ['tool.py'], context.workspace.getCurrentFolder(), '사용자 입력\n');
console.log('exitCode:', result.exitCode);
console.log('stdout:', result.stdout);
```

---

## 8.1 콘솔 로깅 API (`context.logger`)

플러그인 실행 중 발생하는 동작 상태, 진행 정보, 경고 및 오류 데이터를 에디터 하단의 **[출력 콘솔]**(`Ctrl+\``) 창에 실시간으로 전송합니다.  
각 로그에는 자동으로 해당 플러그인의 식별 태그(`[Plugin: 플러그인명]`)가 부착되며, 타임스탬프, 로그 레벨별 배지, 객체 펼쳐보기, 소스/레벨별 필터링, 클립보드 복사를 지원합니다.

```typescript
// 1. 일반 정보 로그
context.logger.info('INI 모드 분석 완료', { sectionCount: 12 });

// 2. 경고 로그
context.logger.warn('일부 텍스처 해시 파일이 누락되었습니다.', missingList);

// 3. 에러 로그 (Error 객체 및 스택 트레이스 자동 지원)
try {
  runTask();
} catch (err) {
  context.logger.error('외부 스크립트 실행 실패:', err);
}

// 4. 디버그 로그
context.logger.debug('파싱 내부 파라미터:', intermediateData);
```

> **콘솔창 접근성**: 사용자는 상단 메뉴 **[보기] -> [콘솔창 보기]**, 단축키 **`Ctrl+\``**, 또는 하단 상태바의 **[콘솔]** 버튼을 통해 언제든지 콘솔 창을 열고 닫을 수 있습니다.

---
