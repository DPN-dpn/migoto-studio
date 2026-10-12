# 커스텀 린트 (Custom Lint)

3Dmigoto 모드 작성 시 리소스 파일(DDS, BUF 등)의 실재성 및 XXMI 네임스페이스 변수/함수 유효성을 실시간으로 검사하는 공식 내장 플러그인입니다.

## 주요 기능

1. **모드 리소스 파일 실재성 검사**
   - 모드 폴더를 열고 `.ini` 파일을 작성할 때, `filename = Textures/Diffuse.dds` 등 대상 파일이 실제로 존재하지 않으면 에디터에 즉시 경고를 표시합니다.

2. **XXMI 네임스페이스 변수 및 함수 유효성 검사**
   - 모드 폴더 내 모든 `.ini` 파일의 `namespace` 선언 및 `[Constants]` 변수, `[CommandList]` 등을 자동으로 색인합니다.
   - `$\Namespace\Var` 또는 `CommandList\Namespace\Action` 구문이 대상 네임스페이스에 선언되어 있는지 검증합니다.
   - 단일 INI 파일로 열었을 경우 외부 네임스페이스 확인이 필요함을 안내합니다.
