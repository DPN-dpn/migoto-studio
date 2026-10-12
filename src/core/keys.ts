/**
 * 3DMigoto Virtual Key (VK_*) definitions and key-binding helpers.
 * Handles mapping browser keyboard events to 3DMigoto Virtual Key codes and modifiers.
 */

export interface VkKeyItem {
  vk: string;
  label: string;
  category: '기능키(F1~F24)' | '문자/숫자' | '방향/이동키' | '숫자패드(Numpad)' | '특수/편집키' | '마우스' | '기호/기타';
  description?: string;
}

export const CODE_TO_VK: Record<string, string> = {
  // Function keys
  F1: 'VK_F1', F2: 'VK_F2', F3: 'VK_F3', F4: 'VK_F4',
  F5: 'VK_F5', F6: 'VK_F6', F7: 'VK_F7', F8: 'VK_F8',
  F9: 'VK_F9', F10: 'VK_F10', F11: 'VK_F11', F12: 'VK_F12',
  F13: 'VK_F13', F14: 'VK_F14', F15: 'VK_F15', F16: 'VK_F16',
  F17: 'VK_F17', F18: 'VK_F18', F19: 'VK_F19', F20: 'VK_F20',
  F21: 'VK_F21', F22: 'VK_F22', F23: 'VK_F23', F24: 'VK_F24',

  // Letters
  KeyA: 'VK_A', KeyB: 'VK_B', KeyC: 'VK_C', KeyD: 'VK_D', KeyE: 'VK_E',
  KeyF: 'VK_F', KeyG: 'VK_G', KeyH: 'VK_H', KeyI: 'VK_I', KeyJ: 'VK_J',
  KeyK: 'VK_K', KeyL: 'VK_L', KeyM: 'VK_M', KeyN: 'VK_N', KeyO: 'VK_O',
  KeyP: 'VK_P', KeyQ: 'VK_Q', KeyR: 'VK_R', KeyS: 'VK_S', KeyT: 'VK_T',
  KeyU: 'VK_U', KeyV: 'VK_V', KeyW: 'VK_W', KeyX: 'VK_X', KeyY: 'VK_Y',
  KeyZ: 'VK_Z',

  // Top-row numbers
  Digit0: 'VK_0', Digit1: 'VK_1', Digit2: 'VK_2', Digit3: 'VK_3', Digit4: 'VK_4',
  Digit5: 'VK_5', Digit6: 'VK_6', Digit7: 'VK_7', Digit8: 'VK_8', Digit9: 'VK_9',

  // Numpad
  Numpad0: 'VK_NUMPAD0', Numpad1: 'VK_NUMPAD1', Numpad2: 'VK_NUMPAD2', Numpad3: 'VK_NUMPAD3',
  Numpad4: 'VK_NUMPAD4', Numpad5: 'VK_NUMPAD5', Numpad6: 'VK_NUMPAD6', Numpad7: 'VK_NUMPAD7',
  Numpad8: 'VK_NUMPAD8', Numpad9: 'VK_NUMPAD9',
  NumpadMultiply: 'VK_MULTIPLY', NumpadAdd: 'VK_ADD',
  NumpadSubtract: 'VK_SUBTRACT', NumpadDecimal: 'VK_DECIMAL',
  NumpadDivide: 'VK_DIVIDE', NumpadEnter: 'VK_RETURN',

  // Navigation & Direction
  ArrowUp: 'VK_UP', ArrowDown: 'VK_DOWN', ArrowLeft: 'VK_LEFT', ArrowRight: 'VK_RIGHT',
  Home: 'VK_HOME', End: 'VK_END',
  PageUp: 'VK_PRIOR', // 3DMigoto uses Windows VK_PRIOR for PageUp
  PageDown: 'VK_NEXT', // 3DMigoto uses Windows VK_NEXT for PageDown

  // Editing & Common Keys
  Space: 'VK_SPACE',
  Tab: 'VK_TAB',
  Enter: 'VK_RETURN',
  Backspace: 'VK_BACK',
  Escape: 'VK_ESCAPE',
  Delete: 'VK_DELETE',
  Insert: 'VK_INSERT',

  // Symbols / OEM
  Semicolon: 'VK_OEM_1',
  Equal: 'VK_OEM_PLUS',
  Comma: 'VK_OEM_COMMA',
  Minus: 'VK_OEM_MINUS',
  Period: 'VK_OEM_PERIOD',
  Slash: 'VK_OEM_2',
  Backquote: 'VK_OEM_3',
  BracketLeft: 'VK_OEM_4',
  Backslash: 'VK_OEM_5',
  BracketRight: 'VK_OEM_6',
  Quote: 'VK_OEM_7',

  // System
  CapsLock: 'VK_CAPITAL',
  ScrollLock: 'VK_SCROLL',
  Pause: 'VK_PAUSE',
  PrintScreen: 'VK_SNAPSHOT',
};

export const VK_KEY_LIST: VkKeyItem[] = [
  // 기능키
  { vk: 'VK_F1', label: 'F1', category: '기능키(F1~F24)' },
  { vk: 'VK_F2', label: 'F2', category: '기능키(F1~F24)' },
  { vk: 'VK_F3', label: 'F3', category: '기능키(F1~F24)' },
  { vk: 'VK_F4', label: 'F4', category: '기능키(F1~F24)' },
  { vk: 'VK_F5', label: 'F5', category: '기능키(F1~F24)' },
  { vk: 'VK_F6', label: 'F6', category: '기능키(F1~F24)' },
  { vk: 'VK_F7', label: 'F7', category: '기능키(F1~F24)' },
  { vk: 'VK_F8', label: 'F8', category: '기능키(F1~F24)' },
  { vk: 'VK_F9', label: 'F9', category: '기능키(F1~F24)' },
  { vk: 'VK_F10', label: 'F10', category: '기능키(F1~F24)' },
  { vk: 'VK_F11', label: 'F11', category: '기능키(F1~F24)' },
  { vk: 'VK_F12', label: 'F12', category: '기능키(F1~F24)' },

  // 문자/숫자
  { vk: 'VK_A', label: 'A', category: '문자/숫자' },
  { vk: 'VK_B', label: 'B', category: '문자/숫자' },
  { vk: 'VK_C', label: 'C', category: '문자/숫자' },
  { vk: 'VK_D', label: 'D', category: '문자/숫자' },
  { vk: 'VK_E', label: 'E', category: '문자/숫자' },
  { vk: 'VK_F', label: 'F', category: '문자/숫자' },
  { vk: 'VK_G', label: 'G', category: '문자/숫자' },
  { vk: 'VK_H', label: 'H', category: '문자/숫자' },
  { vk: 'VK_I', label: 'I', category: '문자/숫자' },
  { vk: 'VK_J', label: 'J', category: '문자/숫자' },
  { vk: 'VK_K', label: 'K', category: '문자/숫자' },
  { vk: 'VK_L', label: 'L', category: '문자/숫자' },
  { vk: 'VK_M', label: 'M', category: '문자/숫자' },
  { vk: 'VK_N', label: 'N', category: '문자/숫자' },
  { vk: 'VK_O', label: 'O', category: '문자/숫자' },
  { vk: 'VK_P', label: 'P', category: '문자/숫자' },
  { vk: 'VK_Q', label: 'Q', category: '문자/숫자' },
  { vk: 'VK_R', label: 'R', category: '문자/숫자' },
  { vk: 'VK_S', label: 'S', category: '문자/숫자' },
  { vk: 'VK_T', label: 'T', category: '문자/숫자' },
  { vk: 'VK_U', label: 'U', category: '문자/숫자' },
  { vk: 'VK_V', label: 'V', category: '문자/숫자' },
  { vk: 'VK_W', label: 'W', category: '문자/숫자' },
  { vk: 'VK_X', label: 'X', category: '문자/숫자' },
  { vk: 'VK_Y', label: 'Y', category: '문자/숫자' },
  { vk: 'VK_Z', label: 'Z', category: '문자/숫자' },
  { vk: 'VK_0', label: '0 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_1', label: '1 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_2', label: '2 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_3', label: '3 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_4', label: '4 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_5', label: '5 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_6', label: '6 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_7', label: '7 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_8', label: '8 (상단 숫자)', category: '문자/숫자' },
  { vk: 'VK_9', label: '9 (상단 숫자)', category: '문자/숫자' },

  // 방향 및 탐색
  { vk: 'VK_UP', label: '위쪽 방향키 (↑)', category: '방향/이동키' },
  { vk: 'VK_DOWN', label: '아래쪽 방향키 (↓)', category: '방향/이동키' },
  { vk: 'VK_LEFT', label: '왼쪽 방향키 (←)', category: '방향/이동키' },
  { vk: 'VK_RIGHT', label: '오른쪽 방향키 (→)', category: '방향/이동키' },
  { vk: 'VK_HOME', label: 'Home', category: '방향/이동키' },
  { vk: 'VK_END', label: 'End', category: '방향/이동키' },
  { vk: 'VK_PRIOR', label: 'Page Up (VK_PRIOR)', category: '방향/이동키', description: '3DMigoto에서는 Page Up을 VK_PRIOR로 지정합니다' },
  { vk: 'VK_NEXT', label: 'Page Down (VK_NEXT)', category: '방향/이동키', description: '3DMigoto에서는 Page Down을 VK_NEXT로 지정합니다' },

  // 숫자패드 (Numpad)
  { vk: 'VK_NUMPAD0', label: 'Numpad 0', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD1', label: 'Numpad 1', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD2', label: 'Numpad 2', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD3', label: 'Numpad 3', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD4', label: 'Numpad 4', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD5', label: 'Numpad 5', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD6', label: 'Numpad 6', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD7', label: 'Numpad 7', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD8', label: 'Numpad 8', category: '숫자패드(Numpad)' },
  { vk: 'VK_NUMPAD9', label: 'Numpad 9', category: '숫자패드(Numpad)' },
  { vk: 'VK_MULTIPLY', label: 'Numpad * (곱하기)', category: '숫자패드(Numpad)' },
  { vk: 'VK_ADD', label: 'Numpad + (더하기)', category: '숫자패드(Numpad)' },
  { vk: 'VK_SUBTRACT', label: 'Numpad - (빼기)', category: '숫자패드(Numpad)' },
  { vk: 'VK_DECIMAL', label: 'Numpad . (소수점)', category: '숫자패드(Numpad)' },
  { vk: 'VK_DIVIDE', label: 'Numpad / (나누기)', category: '숫자패드(Numpad)' },

  // 특수/편집키
  { vk: 'VK_SPACE', label: 'Space (스페이스바)', category: '특수/편집키' },
  { vk: 'VK_RETURN', label: 'Enter (엔터)', category: '특수/편집키' },
  { vk: 'VK_TAB', label: 'Tab (탭)', category: '특수/편집키' },
  { vk: 'VK_BACK', label: 'Backspace (백스페이스)', category: '특수/편집키' },
  { vk: 'VK_ESCAPE', label: 'Esc (이스케이프)', category: '특수/편집키' },
  { vk: 'VK_DELETE', label: 'Delete (삭제)', category: '특수/편집키' },
  { vk: 'VK_INSERT', label: 'Insert (삽입)', category: '특수/편집키' },

  // 마우스 버튼
  { vk: 'VK_LBUTTON', label: '마우스 좌클릭 (LButton)', category: '마우스' },
  { vk: 'VK_RBUTTON', label: '마우스 우클릭 (RButton)', category: '마우스' },
  { vk: 'VK_MBUTTON', label: '마우스 휠클릭 (MButton)', category: '마우스' },
  { vk: 'VK_XBUTTON1', label: '마우스 보조 1 (앞으로가기)', category: '마우스' },
  { vk: 'VK_XBUTTON2', label: '마우스 보조 2 (뒤로가기)', category: '마우스' },

  // 기호/기타
  { vk: 'VK_OEM_1', label: '; : (세미콜론)', category: '기호/기타' },
  { vk: 'VK_OEM_PLUS', label: '= + (등호/더하기)', category: '기호/기타' },
  { vk: 'VK_OEM_COMMA', label: ', < (쉼표)', category: '기호/기타' },
  { vk: 'VK_OEM_MINUS', label: '- _ (하이픈/밑줄)', category: '기호/기타' },
  { vk: 'VK_OEM_PERIOD', label: '. > (마침표)', category: '기호/기타' },
  { vk: 'VK_OEM_2', label: '/ ? (슬래시)', category: '기호/기타' },
  { vk: 'VK_OEM_3', label: '` ~ (물결표/백틱)', category: '기호/기타' },
  { vk: 'VK_OEM_4', label: '[ { (대괄호 열기)', category: '기호/기타' },
  { vk: 'VK_OEM_5', label: '\\ | (백슬래시/파이프)', category: '기호/기타' },
  { vk: 'VK_OEM_6', label: '] } (대괄호 닫기)', category: '기호/기타' },
  { vk: 'VK_OEM_7', label: '\' " (따옴표)', category: '기호/기타' },
  { vk: 'VK_CAPITAL', label: 'Caps Lock', category: '기호/기타' },
  { vk: 'VK_SNAPSHOT', label: 'Print Screen', category: '기호/기타' },
  { vk: 'VK_PAUSE', label: 'Pause / Break', category: '기호/기타' },
];

/**
 * Formats modifier flags and virtual key code into 3DMigoto syntax:
 * e.g. "no_modifiers VK_F1" or "ctrl alt VK_1"
 */
export function formatKeyBinding(options: {
  vk: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  win?: boolean;
}): string {
  const parts: string[] = [];
  if (options.ctrl) parts.push('ctrl');
  if (options.alt) parts.push('alt');
  if (options.shift) parts.push('shift');
  if (options.win) parts.push('windows');

  if (parts.length === 0) {
    parts.push('no_modifiers');
  }

  parts.push(options.vk);
  return parts.join(' ');
}

export type KeyInsertFormat = 'value' | 'line' | 'toggle' | 'hold';

/**
 * Generates ready-to-insert text based on the chosen format.
 */
export function generateKeySnippet(format: KeyInsertFormat, keyString: string): string {
  switch (format) {
    case 'value':
      return keyString;
    case 'line':
      return `key = ${keyString}\n`;
    case 'toggle':
      return `[KeyToggle]\nkey = ${keyString}\ntype = cycle\n$variable = 0, 1\n`;
    case 'hold':
      return `[KeyHold]\nkey = ${keyString}\ntype = hold\n$variable = 1\n`;
  }
}
