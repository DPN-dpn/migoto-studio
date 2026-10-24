# INI 문서 파싱 및 조작 API (`context.ini`)


3DMigoto 및 XXMI 문법에 특화된 고수준 조작 유틸리티를 제공합니다.

```typescript
// 1. 토글 키 섹션 텍스트 생성
const keyToggleBlock = context.ini.formatKeyToggle({
  sectionName: 'KeyToggleHair',
  key: 'no_modifiers alt VK_F4',
  type: 'cycle',
  states: 3,
  variableName: '$hair',
  comments: ['머리 모양 순환 토글'],
});

// 2. 키 바인딩 문자열 파싱 (수식키 및 가상키 분해)
const parsedKey = context.ini.parseKeyBinding('ctrl no_alt VK_F4');
// { vk: 'VK_F4', ctrl: 'require', alt: 'exclude', shift: 'none', win: 'none' }

// 3. 키 바인딩 문자열 조합
const keyStr = context.ini.formatKeyBinding({
  vk: 'VK_F4',
  ctrl: 'require',
  alt: 'exclude',
});
// "ctrl no_alt VK_F4"

// 4. 지원하는 3DMigoto 가상키 전체 목록 조회
const allKeys = context.ini.getKeyList();
// [ { vk: 'VK_F1', label: 'F1', category: '기능키(F1~F12)' }, ... ]

// 5. 현재 열린 INI 파일에 섹션 추가/업데이트 (기존 섹션은 제자리 교체)
context.ini.upsertSection('KeyToggleHair', {
  key: 'no_modifiers alt VK_F4',
  type: 'cycle',
  '$hair': '0, 1, 2',
});

// 6. 특정 섹션 삭제
context.ini.deleteSection('KeyToggleHair');

// 7. 섹션 검색 및 목록
const sections = context.ini.getSections(); // 현재 문서의 모든 섹션 배열
const keySec = context.ini.findSection(/^Key/i); // 정규식 또는 문자열로 섹션 검색

// 8. 문서 내 선언된 모든 변수 목록 가져오기
const variables = context.ini.getVariables(); // { "$hair": "0", "$active": "1" }

// 9. INI 심볼(변수, 리소스, CommandList, 섹션) 고속 구조 분석
const symbols = context.ini.extractSymbols();
// {
//   variables: { "swapvar": "초기값: 0", "skin": "[Constants] 초기값: 1" },
//   resources: ["ResourceTextureBody", "ResourceBuffer"],
//   commandLists: ["CommandListSwap"],
//   sections: ["Constants", "KeyToggleDress", ...]
// }

// 10. 원본 파싱 및 수동 병합
const doc = context.ini.parse();
const kind = context.ini.classifySection('TextureOverrideBody');
const merged = context.ini.merge(currentTargetText, newSectionText, { appendNew: true });

// 11. 화면 표시용 단축키 변환 (부정키 제거 및 깔끔한 조합 표기)
const displayKey = context.ini.formatDisplayKey('no_modifiers alt VK_F4');
// 'Alt + F4'
const customDisplay = context.ini.formatDisplayKey('ctrl no_alt no_shift VK_F1');
// 'Ctrl + F1'

// 12. 중복 키 / if-endif 조건문 / 주석 보존 원본 섹션 조작 (Raw Section API)
// 딕셔너리({ key: val }) 구조로 다 담기 어려운 다중 drawindexed나 주석, if문 구조를 그대로 읽고 수정합니다.
const rawBlock = context.ini.getSectionRaw('TextureOverrideBody');
// [TextureOverrideBody]
// hash = abcdef12
// match_first_index = 0
// drawindexed = auto
// match_first_index = 100
// drawindexed = auto

// 섹션 라인 단위 구조 파싱
const lines = context.ini.parseSectionLines('TextureOverrideBody');
// [
//   { type: 'property', key: 'hash', value: 'abcdef12', isProperty: true, raw: 'hash = abcdef12' },
//   { type: 'property', key: 'match_first_index', value: '0', isProperty: true, ... },
//   { type: 'property', key: 'drawindexed', value: 'auto', isProperty: true, ... },
//   ...
// ]

// 기존 주석/라인 배치를 온전히 유지한 채 에디터의 해당 섹션만 통째로 제자리 교체 (실행 취소 Ctrl+Z 보존)
context.ini.setSectionRaw('TextureOverrideBody', `[TextureOverrideBody]\nhash = abcdef12\nmatch_first_index = 0\ndrawindexed = auto`);
```


---
