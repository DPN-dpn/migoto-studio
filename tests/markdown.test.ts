import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatInlineMarkdown,
  renderMarkdownToHtml,
} from '../src/ui/common/markdown.ts';

test('escapeHtml escapes dangerous HTML characters', () => {
  assert.equal(
    escapeHtml('<script>alert("xss") & \'test\'</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;) &amp; &#39;test&#39;&lt;/script&gt;',
  );
});

test('formatInlineMarkdown handles bold, italic, strikethrough, code and links', () => {
  const input = '**Bold** and *Italic* and ***Both*** and ~~Strike~~ and `code block` and [My Link](https://github.com)';
  const formatted = formatInlineMarkdown(input);

  assert.ok(formatted.includes('<strong>Bold</strong>'));
  assert.ok(formatted.includes('<em>Italic</em>'));
  assert.ok(formatted.includes('<strong><em>Both</em></strong>'));
  assert.ok(formatted.includes('<del>Strike</del>'));
  assert.ok(formatted.includes('<code class="md-code">code block</code>'));
  assert.ok(formatted.includes('<a href="https://github.com" target="_blank" rel="noopener noreferrer" class="md-link">My Link</a>'));
});

test('formatInlineMarkdown preserves $ variables and backslashes', () => {
  const input = 'Updated `$var` and **$MyVar\\Sub** with `this = ResourceName`';
  const formatted = formatInlineMarkdown(input);

  assert.ok(formatted.includes('<code class="md-code">$var</code>'));
  assert.ok(formatted.includes('<strong>$MyVar\\Sub</strong>'));
  assert.ok(formatted.includes('<code class="md-code">this = ResourceName</code>'));
});

test('renderMarkdownToHtml formats headings and horizontal rules', () => {
  const md = '# Header 1\n## Header 2\n### Header 3\n---';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('<h1 class="md-h md-h1">Header 1</h1>'));
  assert.ok(html.includes('<h2 class="md-h md-h2">Header 2</h2>'));
  assert.ok(html.includes('<h3 class="md-h md-h3">Header 3</h3>'));
  assert.ok(html.includes('<hr class="md-hr">'));
});

test('renderMarkdownToHtml formats nested lists properly', () => {
  const md = `- Item 1
- Item 2
  - Subitem 2.1
  - Subitem 2.2
- Item 3`;

  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('<ul class="md-ul">'));
  assert.ok(html.includes('<li>Item 1'));
  assert.ok(html.includes('<li>Item 2'));
  assert.ok(html.includes('<li>Subitem 2.1'));
  assert.ok(html.includes('<li>Subitem 2.2'));
  assert.ok(html.includes('<li>Item 3'));
  // Must have nested ul
  const ulCount = (html.match(/<ul class="md-ul">/g) || []).length;
  assert.equal(ulCount, 2, 'Should contain 2 ul tags for nested structure');
});

test('renderMarkdownToHtml formats fenced code blocks', () => {
  const md = '```ini\n[TextureOverride]\nhash = abc\n```';
  const html = renderMarkdownToHtml(md);

  assert.ok(html.includes('<pre class="md-pre"><code class="md-code-block language-ini">[TextureOverride]\nhash = abc</code></pre>'));
});

test('renderMarkdownToHtml formats release notes structure seamlessly', () => {
  const releaseNotes = `## Migoto Studio v0.10.1

### 신규 기능
- 웹 버전 기본 플러그인 정적 서빙 지원: 웹 환경에서도 \`DDS/텍스처 뷰어\`, **AI 어시스턴트** 지원

### 다운로드 안내
- 설치형 프로그램: 아래 Assets에서 \`Migoto.Studio_0.10.1_x64-setup.exe\`를 다운로드하여 설치하세요.
  - 윈도우 시작 메뉴 및 프로그램 추가/제거에 등록됩니다.
  - 제거 시 앱 데이터 폴더(%APPDATA%\\MigotoStudio) 정리 체크박스를 지원합니다.
- 무설치 포터블 버전: [다운로드](https://github.com/DPN-dpn/migoto-studio/releases)
- 웹 버전: https://DPN-dpn.github.io/migoto-studio/`;

  const html = renderMarkdownToHtml(releaseNotes);

  assert.ok(html.includes('<h2 class="md-h md-h2">Migoto Studio v0.10.1</h2>'));
  assert.ok(html.includes('<h3 class="md-h md-h3">신규 기능</h3>'));
  assert.ok(html.includes('<code class="md-code">DDS/텍스처 뷰어</code>'));
  assert.ok(html.includes('<strong>AI 어시스턴트</strong>'));
  assert.ok(html.includes('<h3 class="md-h md-h3">다운로드 안내</h3>'));
  assert.ok(html.includes('윈도우 시작 메뉴 및 프로그램 추가/제거에 등록됩니다.'));
  assert.ok(html.includes('<a href="https://github.com/DPN-dpn/migoto-studio/releases" target="_blank" rel="noopener noreferrer" class="md-link">다운로드</a>'));
  assert.ok(html.includes('<a href="https://DPN-dpn.github.io/migoto-studio/" target="_blank" rel="noopener noreferrer" class="md-link">https://DPN-dpn.github.io/migoto-studio/</a>'));
});
