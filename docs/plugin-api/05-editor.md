# 에디터 제어 API (`context.editor`)


```typescript
// 텍스트 읽기 및 변경
const allText = context.editor.getText();
const selected = context.editor.getSelectedText();
context.editor.insertText('삽입할 내용');
context.editor.replaceSelection('교체할 내용');

// 커서 위치
const cursor = context.editor.getCursor(); // { lineNumber, column }
context.editor.setCursor(10, 1);

// 에디터 우클릭 컨텍스트 메뉴 추가
context.editor.registerContextMenuAction({
  id: 'my-action',
  label: '선택 영역 변환',
  onClick: () => {
    const text = context.editor.getSelectedText();
    context.editor.replaceSelection(text.toUpperCase());
  },
});

// 인라인 변경 제안 및 사용자 검토 (수락/되돌리기 지원)
const result = await context.editor.proposeChanges(newIniText);

if (result.accepted) {
  context.ui.showToast('변경사항이 적용되었습니다.', 'info');
} else {
  context.ui.showToast('변경이 취소되고 원래 코드로 복구되었습니다.', 'warn');
}
```

---
