# 커스텀 린트 (Custom Lint)

ZZMI(젠레스 존 제로) 텍스처 슬롯픽스/TTL 투명도 및 SRMI(붕괴: 스타레일) 전용 문법을 검사하고 모드 템플릿을 제공하는 공식 확장 예제 플러그인입니다.

> [!NOTE]
> XXMI 표준 내장 문법(help.ini 등), 리소스 파일 실재성 검사(`filename = ...`) 및 모드 폴더 네임스페이스 인덱싱/검사는 **Migoto Studio 코어 엔진**으로 완전히 통합되어 기본 제공됩니다.
> 본 플러그인은 특정 게임/도메인별 추가 린트 규칙과 템플릿을 등록하는 플러그인 예제 역할을 담당합니다.

## 주요 기능

1. **ZZMI (젠레스 존 제로) 및 TTL 지원**
   - `CommandList\ZZMI\SetTextures`, `Resource\ZZMI\...` 슬롯픽스 구문 및 `TTL` (Transparency Texture Lib) 투명도 문법 인식
   - 텍스처 슬롯픽스(SlotFix) 리졸버 및 코드 템플릿(스니펫) 자동 등록

2. **SRMI (붕괴: 스타레일) 지원**
   - `$\SRMI\vertex_count`, `Resource\SRMI\PositionBuffer`, `Resource\SRMI\BlendBuffer` 등 SRMI 전용 문법 및 버텍스 수 오버라이드 지원

## 코드 구조

- `zzmi/`: ZZMI 텍스처 슬롯픽스 템플릿/리졸버 및 TTL 지원 (`rules`, `templates`, `registerZzmiSupport`)
- `srmi/`: SRMI 전용 변수/리소스 문법 지원 (`rules`, `registerSrmiSupport`)
