# ZZMI 지원 플러그인 (ZZMI Support)
 
Zenless Zone Zero (젠레스 존 제로)의 3Dmigoto 모드 프레임워크인 **ZZMI** 및 전용 라이브러리를 지원하는 공식 내장 플러그인입니다.

> [!NOTE]
> 네임스페이스 등 XXMI 기본 문법은 [커스텀 린트 플러그인](../custom-lint/README.md)에서 공통으로 처리되며, 본 플러그인은 **ZZMI 전용 문법(슬롯픽스, WEngineFX 등) 및 ZZMI 전용 라이브러리(TTL 등)** 구문을 전담합니다.

## 주요 기능

1. **ZZMI 전용 린트 규칙 지원**
   - `run = CommandList\ZZMI\SetTextures` 등 역슬래시(`\`)가 포함된 ZZMI 전용 내장 커맨드리스트를 정상 문법으로 인식합니다.
   - `Resource\ZZMI\...` 슬롯 매핑 리소스를 오류/경고 없이 통과시킵니다.

2. **TTL (Transparency Texture Lib) 지원**
   - ZZMI의 반투명 텍스처 라이브러리인 TTL 전용 구문 지원:
     - 커맨드리스트: `run = CommandList\TTL\Draw`
     - 리소스: `Resource\TTL\TransparencyTex = ref Resource...`
     - 변수: `$\TTL\alpha`, `$\TTL\_1`, `$\TTL\_2`, `$\TTL\mask_channel`, `$\TTL\mask_invert` 등
   - 미정의 리소스/변수 경고 없이 정상적인 ZZMI TTL 구문으로 인식합니다.

3. **코드 템플릿 제공**
   - **ZZMI 텍스처 슬롯픽스 (SlotFix)**: Diffuse, NormalMap, LightMap, MaterialMap 및 `WEngineFX` 슬롯 기본 포함.
   - **ZZMI TTL 드로우 (Uniform Alpha)**: 텍스처 없이 알파 값으로만 반투명을 적용하는 빠른 설정 템플릿.
   - **ZZMI TTL 반투명 텍스처 (Texture Mask)**: 투명도 마스크 텍스처(`TransparencyTex`)와 채널 설정을 포함하는 반투명 렌더링 템플릿.
