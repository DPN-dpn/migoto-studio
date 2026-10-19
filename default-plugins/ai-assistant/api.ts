import type { PluginContext } from '../../src/plugins/types.ts';

export const AVAILABLE_MODELS = [
  { name: 'gemini-flash-latest', label: 'gemini-flash-latest' },
  { name: 'gemini-pro-latest', label: 'gemini-pro-latest' },
  { name: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { name: 'gpt-4o', label: 'gpt-4o' },
];

export const SYSTEM_PROMPT = `당신은 3DMigoto 및 XXMI (.ini) 모딩 전문 개발 도우미입니다.
사용자가 제공한 [문서 구조 요약] 및 [관련 섹션 본문]을 바탕으로 질문의 의도를 분석하고 정확한 INI 코드를 작성하세요.

[3DMigoto / XXMI 문법 및 시스템 키워드 규칙]
1. 빌트인 시스템 변수 (중요):
   - 3DMigoto 및 XXMI 엔진에서 자체 제공하는 시스템 변수 및 상수들은 '$' 접두사를 붙이지 않는 정식 내장 키워드입니다:
     * 드로우 및 파이프라인: draw_type (또는 DRAW_TYPE), vertex_count, index_count, instance_count, first_vertex, first_index, first_instance, indirect_offset
     * 화면 및 해상도: rt_width, rt_height, res_width, res_height, window_width, window_height, scissor_left, scissor_top, scissor_right, scissor_bottom
     * 상태 및 시간: time, frame_time, fps, frame_number, draw_number, dispatch_number, hunting, sli, frame_analysis, cursor_showing, cursor_x, cursor_y, separation, convergence
   - 예시: 'if draw_type == 1' 또는 'if DRAW_TYPE == 1'은 3DMigoto/XXMI의 완전한 표준 정식 문법입니다.
   - 절대 이 키워드들을 사용자 변수로 오인하여 '$'를 붙이도록 하거나 [Constants]에 'global $DRAW_TYPE = 0' 등으로 선언하라고 잘못 지적하지 마십시오.
2. 사용자 정의 변수:
   - 모더가 정의하는 상태 변수나 토글 변수는 '$'로 시작합니다 (예: '$toggle', '$active', 'global $costume = 0').
   - 사용자 변수는 [Constants] 섹션에 선언되거나 [KeyToggle] 등에서 정의됩니다.
3. 조건문 문법 및 elif 지원 (매우 중요):
   - 3DMigoto 및 XXMI 파서는 'if', 'elif', 'else if', 'else', 'endif'를 공식적으로 완전하게 지원합니다.
   - 예시 구조:
     if <조건1>
         ...
     elif <조건2>
         ...
     else if <조건3>
         ...
     else
         ...
     endif
   - 'elif'와 'else if'는 3DMigoto/XXMI 파서가 지원하는 정식 표준 문법입니다. 절대로 'elif가 지원되지 않는다'고 잘못 답변하거나, 이를 별도의 개별 'if' 문으로 강제 분리하라고 안내하지 마십시오.
   - 조건 비교 연산자: '==', '!=', '>=', '<=', '>', '<' 등을 지원합니다 (단독 '='는 할당이므로 조건식에서는 '==' 사용).
   - 모든 조건 분기 블록('if ... elif ... else')은 마지막에 단 하나의 'endif'로 닫힙니다.

[중요 작성 규칙]
1. 파일 전체 코드를 처음부터 끝까지 다시 작성하지 마십시오.
2. 사용자의 요청에 따라 새로 생성하거나 수정해야 할 특정 섹션([KeyToggle], [TextureOverride], [Constants], [CommandList] 등) 단위만 마크다운 \`\`\`ini 코드 \`\`\` 블록으로 작성하십시오.
3. 에디터가 해당 섹션만 찾아 제자리(in-place)에 스마트 교체하므로, 변경이 필요한 섹션들만 온전하게 작성하면 됩니다.
4. 코드 블록 외의 추가 설명이나 가이드는 명확하고 간결하게 작성하십시오.`;

export function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export interface SendAiOptions {
  context: PluginContext;
  apiUrl: string;
  apiKey: string;
  model: string;
  userPromptWithContext: string;
  signal: AbortSignal;
  onRetryStep?: (attempt: number, maxRetries: number, waitSec: number, reason: string) => void;
  onRetryWaitDone?: (attempt: number, maxRetries: number) => void;
}

export async function callAiChatApi(options: SendAiOptions): Promise<string> {
  const { context, apiUrl, apiKey, model, userPromptWithContext, signal, onRetryStep, onRetryWaitDone } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    if (apiUrl.includes('generativelanguage.googleapis.com')) {
      headers['x-goog-api-key'] = apiKey;
    }
  }

  const maxRetries = 2;
  let attempt = 0;
  let replyData: any = null;

  context.logger?.info(`AI 요청 전송: 모델=${model}, 엔드포인트=${apiUrl}`);

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const res = await context.fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPromptWithContext },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let cleanErr = errText;
        try {
          const parsed = JSON.parse(errText);
          if (Array.isArray(parsed) && parsed[0]?.error?.message) {
            cleanErr = parsed[0].error.message;
          } else if (parsed?.error?.message) {
            cleanErr = parsed.error.message;
          }
        } catch {
          // Not JSON, use errText as-is
        }

        if ((res.status === 503 || res.status === 429) && attempt <= maxRetries) {
          const waitSec = attempt === 1 ? 2.0 : 3.5;
          onRetryStep?.(attempt, maxRetries, waitSec, `서버 일시 과부하 (${res.status}) 감지`);
          await delayWithAbort(waitSec * 1000, signal);
          onRetryWaitDone?.(attempt, maxRetries);
          continue;
        }
        throw new Error(`API 오류 (${res.status}): ${cleanErr}`);
      }

      replyData = await res.json();
      break;
    } catch (err: any) {
      if (signal.aborted) {
        throw err;
      }
      if (attempt > maxRetries) {
        throw err;
      }
      const waitSec = 2.0;
      onRetryStep?.(attempt, maxRetries, waitSec, '네트워크 응답 지연');
      await delayWithAbort(waitSec * 1000, signal);
      onRetryWaitDone?.(attempt, maxRetries);
    }
  }

  const content = replyData?.choices?.[0]?.message?.content || '(응답 없음)';
  context.logger?.info(`AI 응답 수신 완료 (길이: ${content.length}자)`);
  return content;
}
