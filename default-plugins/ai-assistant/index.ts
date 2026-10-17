import type { PluginContext, MigotoPlugin } from '../../src/plugins/types.ts';
import iconSvg from './icon.ts';
import { buildAiAssistantView } from './ui.ts';

/**
 * AI 모딩 어시스턴트 플러그인
 * OpenAI 또는 Google Gemini, 로컬 Ollama 호환 API를 연동하여 INI 분석, 섹션 생성 및 질의응답을 수행합니다.
 *
 * 모듈 구성:
 * - index.ts: 플러그인 생명주기 및 사이드바 뷰 등록 진입점
 * - ui.ts: 대화창, 설정 탭, 스마트 적용 및 인터랙션 UI
 * - api.ts: OpenAI / Gemini / Ollama API 요청 및 에러 재시도 로직
 * - context-builder.ts: INI 문서 분석 및 스마트 컨텍스트 프롬프트 빌더
 * - markdown.ts: 마크다운 파서 및 코드 블록 하이라이트 렌더러
 * - icon.ts: 플러그인 전용 SVG 아이콘
 */
const plugin: MigotoPlugin = {
  activate(context: PluginContext) {
    context.ui.registerSidebarView({
      id: 'ai-assistant',
      title: 'AI 에이전트',
      icon: iconSvg,
      render(container) {
        return buildAiAssistantView(context, container);
      },
    });
  },
  deactivate() {},
};

export default plugin;
