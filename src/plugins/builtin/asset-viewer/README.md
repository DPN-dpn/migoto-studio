# DDS / 텍스처 뷰어 플러그인 (Asset Viewer Plugin)

이 플러그인은 Migoto Studio의 커스텀 에디터 뷰어 확장 기능을 활용하는 표준 빌트인 플러그인 예제입니다.

## 개요
- **플러그인 ID**: `asset-viewer`
- **버전**: `1.1.0`
- **카테고리**: `assets`
- **위치**: 파일 탐색기 및 에디터 탭 (.dds, 이미지 파일)

## 디렉터리 구조
```
asset-viewer/
├── plugin.json       # 플러그인 매니페스트 (ID, 이름, 버전, 확장 파일 정보)
├── index.ts          # 플러그인 생명주기 진입점 (activate / deactivate)
├── dds-decoder.ts    # DDS 압축 포맷 (BC1-BC7, DX10) 순수 디코더 모듈
├── image-viewer.ts   # 캔버스 뷰어 UI (줌/팬, sRGB/Linear 전환, 채널 필터)
└── README.md         # 플러그인 설명 문서
```

## 플러그인 동작 방식
`context.editor.registerCustomViewer()` API를 호출하여 특정 확장자 목록이 열릴 때 기본 텍스트 에디터 대신 커스텀 DOM 엘리먼트를 에디터 탭 내에 렌더링하도록 등록합니다.

```typescript
context.editor.registerCustomViewer({
  id: 'asset-viewer',
  name: 'DDS / 텍스처 뷰어',
  extensions: ['dds', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'],
  render(container, file) {
    const viewer = new ImageViewer(container);
    viewer.show({
      name: file.name,
      path: file.path,
      bytes: file.bytes,
    });
    return () => viewer.dispose();
  },
});
```
