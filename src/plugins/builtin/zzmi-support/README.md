# ZZMI 지원 플러그인 (ZZMI Support)

Zenless Zone Zero (젠레스 존 제로)의 3Dmigoto 모드 프레임워크인 **ZZMI**를 지원하는 공식 내장 플러그인입니다.

## 주요 기능

1. **ZZMI 린트 규칙 지원**
   - `run = CommandList\ZZMI\SetTextures` 등 역슬래시(`\`)가 포함된 ZZMI 내장 커맨드리스트를 정상 문법으로 인식하여 오류/경고 없이 통과시킵니다.
   - `Resource\ZZMI\...` 슬롯 매핑 문법을 지원합니다.

2. **ZZMI 텍스처 슬롯픽스(SlotFix) 템플릿**
   - 템플릿 패널 및 코드 자동완성에 `ZZMI 텍스처 슬롯픽스 (SlotFix)` 템플릿을 제공합니다.
   - Diffuse, NormalMap, LightMap, MaterialMap 및 `WEngineFX` 슬롯 줄이 기본 포함되어 있어 손쉽게 탭으로 이동하며 모드를 작성할 수 있습니다.
