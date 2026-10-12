# 릴리스 노트 (Release Notes)

## [다음 버전]

### 플러그인 공식 API 및 UI 빌더 구현
- 플러그인 전용 공식 API 및 TypeScript 개발 진입점 제공
  - 단일 진입점 `src/plugins/api.ts` 및 자동 완성을 위한 `definePlugin` 헬퍼 제공
  - `context.ui` 고수준 UI 빌더 API 구현 (헤더, 셀렉트, 인풋, 체크박스, 버튼, 에디터, 실시간 콘솔, AI 대화 버블 등)
  - 기존 원시 문자열 배열 방식(standalone.ts, 821줄) 전면 폐지 및 순수 TypeScript 선언적 코드로 전환

### 내장 플러그인 모듈화 및 뷰어 고도화
- DDS / 텍스처 뷰어 고도화 (asset-viewer v1.1.0)
  - 현대 게임 텍스처 규격인 BC7 (Mode 0~7) 전체 디코딩 및 DX10 확장 헤더(dxgiFormat) 완벽 지원
  - BC1 (DXT1), BC2 (DXT3), BC3 (DXT5), BC4, BC5(노말맵 Z 복원) 디코딩 지원
  - 실시간 [sRGB] / [Linear] / [Raw] 색공간 전환 뷰 지원 (LUT 감마 보정)
  - 실시간 [RGBA], [RGB], [R], [G], [B], [A] 채널 분리 필터 지원
- 빌트인 플러그인 폴더 모듈화 및 표준화
  - 빌트인 플러그인(asset-viewer, python-runner, ai-assistant)을 외부 플러그인과 동일한 폴더 구조(`src/plugins/builtin/<plugin-id>/`)로 분리
  - 각 플러그인마다 plugin.json, index.ts, README.md를 갖추어 새 플러그인 제작 시 참조할 수 있는 표준 예제 역할 수행
  - 전용 뱃지 및 아이콘 코드(IMG, PY, AI, PLG) 적용

### 릴리스 관리 자동화
- 자동화된 릴리스 스크립트(`npm run release`) 추가
  - 버전 동기화(package.json, tauri.conf.json, Cargo.toml 등), release-notes.md 생성, Git 태그 생성 자동화
  - 릴리스 완료 시 다음 개발 주기를 위해 CHANGELOG.md를 자동으로 비우는 파이프라인 연동
