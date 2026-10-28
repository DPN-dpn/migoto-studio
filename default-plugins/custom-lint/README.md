# 커스텀 린트 (Custom Lint)

3Dmigoto 모드 작성 시 원본 migoto-ini 확장 문법에 적용되지 않은 **XXMI 기본 문법**에 대응하고, 리소스 파일(DDS, BUF 등)의 실재성 및 네임스페이스 변수/함수 유효성을 실시간으로 검사하는 공식 내장 플러그인입니다.

> [!NOTE]
> 본 플러그인은 특정 게임이나 개별 라이브러리(ZZMI, TTL 등)에 종속되지 않는 **순수 범용 XXMI 기본 문법**만을 전담합니다. 특정 게임이나 전용 라이브러리 문법은 각각의 지원 플러그인(예: ZZMI 지원 플러그인)에서 처리합니다.

## 주요 기능

1. **XXMI 기본 문법 및 네임스페이스 검사**
   - 모드 폴더 내 모든 `.ini` 파일의 `namespace` 선언 및 `[Constants]` 변수, `[CommandList]` 등을 자동으로 색인합니다.
   - `$\Namespace\Var` 또는 `CommandList\Namespace\Action` 구문이 대상 네임스페이스에 선언되어 있는지 상호 검증합니다.
   - 단일 INI 파일로 열었을 경우 외부 네임스페이스 확인이 필요함을 안내합니다.

2. **모드 리소스 파일 실재성 검사**
   - 모드 폴더를 열고 `.ini` 파일을 작성할 때, `filename = Textures/Diffuse.dds` 등 대상 파일이 실제로 존재하지 않으면 에디터에 즉시 경고를 표시합니다.

4. **XXMI 빌트인 ShaderFixes\help.ini 레거시 지원**
   - `CustomShader\ShaderFixes\help.ini\FormatText`, `Resource\ShaderFixes\help.ini\...`, `$\ShaderFixes\help.ini\notification_timeout` 등 XXMI 엔진 내장 help.ini 구문을 정상 구문으로 인식합니다.

5. **ZZMI (젠레스 존 제로) 및 TTL 지원**
   - `CommandList\ZZMI\SetTextures`, `Resource\ZZMI\...` 슬롯픽스 구문 및 `TTL` (Transparency Texture Lib) 투명도 문법 인식
   - 텍스처 슬롯픽스(SlotFix) 리졸버 및 코드 템플릿(스니펫) 자동 등록

6. **SRMI (붕괴: 스타레일) 지원**
   - `$\SRMI\vertex_count`, `Resource\SRMI\PositionBuffer`, `Resource\SRMI\BlendBuffer` 등 SRMI 전용 문법 및 버텍스 수 오버라이드 지원
   - SRMI 전용 코드 템플릿(스니펫) 등록

## 코드 구조 (모듈화)

- `builtin-syntax/`: XXMI 내장 커맨드리스트, 함수 및 ShaderFixes\help.ini 빌트인 구문 허용 (`matcher.ts`, `help-ini.ts`, `registerBuiltinSyntax`)
- `file-check/`: 모드 리소스 파일 실재성 검사 (`missing-resource-files`, `registerFileCheckRule`)
- `namespace-check/`: XXMI 네임스페이스 및 변수 유효성 검사, 크로스 파일 심볼 인덱싱 및 정의/참조 Provider (`xxmi-namespace-check`, `parser`, `indexer`, `providers`)
- `zzmi/`: ZZMI 텍스처 슬롯픽스 템플릿/리졸버 및 TTL 지원 (`rules`, `templates`, `registerZzmiSupport`)
- `srmi/`: SRMI 전용 변수/리소스 문법 및 버텍스 오버라이드 템플릿 (`rules`, `templates`, `registerSrmiSupport`)


