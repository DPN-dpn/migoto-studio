/**
 * 플러그인 아이콘 프리셋 및 렌더링 해석기
 * SVG 프리셋 키워드, 직접 입력된 <svg>, 이모지, 텍스트를 모두 지원합니다.
 */

export const PRESET_PLUGIN_ICONS: Record<string, string> = {
  // 1. AI / 어시스턴트 (Sparkles, Bot)
  sparkles: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"></path></svg>`,
  ai: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"></path></svg>`,
  bot: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`,

  // 2. 텍스처 / 이미지 뷰어 (Image, Texture)
  image: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`,
  img: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`,
  texture: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`,

  // 3. 파이썬 (Python 공식 로고 SVG)
  python: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>`,
  py: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.803v.825H3.904S0 5.79 0 11.907c0 6.12 3.4 5.925 3.4 5.925h2.031v-2.846s-.11-3.4 3.344-3.4h5.753s3.238.053 3.238-3.187V2.656S18.17 0 11.914 0zm-3.23 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.4 22.162c6.095 0 5.714-2.656 5.714-2.656l-.006-2.752H12v-.825h8.105s3.904.443 3.904-5.674c0-6.12-3.4-5.925-3.4-5.925h-2.031v2.846s.11 3.4-3.344 3.4H9.481s-3.238-.053-3.238 3.187v5.748s-.404 2.656 5.84 2.656zm3.23-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>`,

  // 4. 리소스 파일 검사기 (File Check, Check)
  'file-check': `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>`,
  chk: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>`,
  check: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>`,
  search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,

  // 5. ZZMI / 게임패드 (Gamepad, ZZMI)
  gamepad: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>`,
  zzmi: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>`,

  // 6. 범용 유틸리티 프리셋
  zap: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  terminal: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  code: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  tool: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  puzzle: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8a2.5 2.5 0 0 1 0 5V19a2 2 0 0 0 2 2h4v-1.5a2.5 2.5 0 0 1 5 0V21h4a2 2 0 0 0 2-2v-4a2.5 2.5 0 0 1 3.5-2.3 2.5 2.5 0 0 0 0-1.7z"></path></svg>`,
};

/**
 * 아이콘 식별자 또는 마크업을 최종 HTML 문자열(SVG 또는 이모지/텍스트)로 변환합니다.
 * @param icon SVG 마크업, 프리셋 이름, 이모지 문자열
 * @param fallback 기본값 (기본: 'PLG')
 */
export function resolvePluginIcon(icon: string | undefined | null, fallback = 'PLG'): string {
  if (!icon) return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('<svg')) return trimmed;
  const lower = trimmed.toLowerCase();
  if (PRESET_PLUGIN_ICONS[lower]) return PRESET_PLUGIN_ICONS[lower];
  return trimmed;
}
