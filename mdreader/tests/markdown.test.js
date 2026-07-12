import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  renderMarkdown,
  preprocessCallouts,
  preprocessEmbeds,
  preprocessWikilinks,
  preprocessFootnotes,
  preprocessTags,
  parseFrontmatter,
} from '../src/lib/parser/markdown.js';

const sampleDir = path.resolve(import.meta.dirname, '../sample');

// ── Sample file smoke tests ─────────────────────────────────────────

describe('sample files render without error', () => {
  const files = ['basic.md', 'smoke-test.md', 'obsidian-sample.md', 'with-katex.md', 'with-mermaid.md'];

  for (const file of files) {
    it(file, () => {
      const content = fs.readFileSync(path.join(sampleDir, file), 'utf8');
      expect(() => renderMarkdown(content)).not.toThrow();
      const html = renderMarkdown(content);
      expect(html.length).toBeGreaterThan(0);
    });
  }
});

// ── Smoke test feature coverage ─────────────────────────────────────

describe('smoke-test.md feature coverage', () => {
  const content = fs.readFileSync(path.join(sampleDir, 'smoke-test.md'), 'utf8');
  const html = renderMarkdown(content);

  const checks = [
    ['code block',          () => html.includes('code-block')],
    ['mermaid block',       () => html.includes('mermaid-block')],
    ['callout rendered',    () => html.includes('callout-note')],
    ['nested callout',      () => html.includes('callout-warning')],
    ['wikilink converted',  () => html.includes('/vault/')],
    ['embed placeholder',   () => html.includes('embed-')],
    ['footnote ref',        () => html.includes('footnote-ref')],
    ['footnote def',        () => html.includes('class="footnotes"')],
    ['tag rendered',        () => html.includes('class="tag"')],
    ['table rendered',      () => html.includes('<table')],
    ['task list',           () => html.includes('task-list')],
    ['blockquote',          () => html.includes('<blockquote')],
    ['heading',             () => html.includes('<h1')],
    ['strikethrough',       () => html.includes('<s>')],
    ['inline code',         () => html.includes('<code>')],
  ];

  for (const [name, fn] of checks) {
    it(name, fn);
  }
});

// ── Code block isolation: preprocessors must not touch content inside fences ──

describe('code block isolation', () => {
  it('wikilinks inside backtick fence are untouched', () => {
    const md = '```\n[[should not]] become a link\n```';
    expect(preprocessWikilinks(md)).not.toContain('/vault/');
  });

  it('wikilinks inside tilde fence are untouched', () => {
    const md = '~~~\n[[should not]] become a link\n~~~';
    expect(preprocessWikilinks(md)).not.toContain('/vault/');
  });

  it('tags inside backtick fence are untouched', () => {
    const md = '```\n#not-a-tag\n```';
    expect(preprocessTags(md)).not.toContain('class="tag"');
  });

  it('tags inside tilde fence are untouched', () => {
    const md = '~~~\n#not-a-tag\n~~~';
    expect(preprocessTags(md)).not.toContain('class="tag"');
  });

  it('embeds inside backtick fence are untouched', () => {
    const md = '```\n![[image.png]]\n```';
    expect(preprocessEmbeds(md, new Set())).not.toContain('embed-');
  });

  it('embeds inside tilde fence are untouched', () => {
    const md = '~~~\n![[image.png]]\n~~~';
    expect(preprocessEmbeds(md, new Set())).not.toContain('embed-');
  });

  it('footnotes inside backtick fence are untouched', () => {
    const md = '```\n[^1] ref\n[^1]: def\n```';
    expect(preprocessFootnotes(md)).not.toContain('footnote-ref');
  });

  it('footnotes inside tilde fence are untouched', () => {
    const md = '~~~\n[^1] ref\n[^1]: def\n~~~';
    expect(preprocessFootnotes(md)).not.toContain('footnote-ref');
  });

  it('callout inside backtick fence is untouched', () => {
    const md = '```\n> [!note]\n> Not a callout\n```';
    expect(preprocessCallouts(md)).not.toContain('class="callout');
  });

  it('callout inside tilde fence is untouched', () => {
    const md = '~~~\n> [!note]\n> Not a callout\n~~~';
    expect(preprocessCallouts(md)).not.toContain('class="callout');
  });
});

// ── Fence detection edge cases ───────────────────────────────────────

describe('fence detection', () => {
  it('tilde fence renders as code block with syntax highlighting', () => {
    const html = renderMarkdown('~~~sql\nSELECT 1\n~~~');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('code-block');
  });

  it('multi-backtick fence (5 backticks) wraps 3-backtick content', () => {
    const html = renderMarkdown('`````\ncode with ``` inside\n`````');
    expect(html).toContain('code-block');
    expect(html).toContain('code with');
  });

  it('closing fence must match opener character', () => {
    // tilde open + backtick close → backtick is content
    const html = renderMarkdown('~~~\nfoo\n```\n~~~');
    expect(html).toContain('foo');
    expect(html).toContain('code-block');
  });

  it('closing fence must have >= opener length', () => {
    // 5 backtick open + 3 backtick close → 3 backtick is content
    const html = renderMarkdown('`````\nfoo\n```\n`````');
    expect(html).toContain('foo');
    expect(html).toContain('code-block');
  });

  it('indented opening fence (0-3 spaces) works', () => {
    const html = renderMarkdown('   ```\ncode\n   ```');
    expect(html).toContain('code-block');
  });

  it('4-space indented fence is not a fence (indented code)', () => {
    const html = renderMarkdown('    ```\nnot a fence\n    ```');
    // Should be treated as regular paragraphs, not a code block
    expect(html).not.toContain('code-block');
  });

  it('backtick inside tilde block is content', () => {
    const html = renderMarkdown('~~~\ncode with ``` inside\n~~~');
    expect(html).toContain('code-block');
    expect(html).toContain('code with');
  });

  it('tilde inside backtick block is content', () => {
    const html = renderMarkdown('```\ncode with ~~~ inside\n```');
    expect(html).toContain('code-block');
    expect(html).toContain('code with ~~~');
  });

  it('closing fence with info string is NOT a fence', () => {
    const html = renderMarkdown('```\nfoo\n```js\n```');
    // ```js should be content, not closing
    expect(html).toContain('code-block');
    expect(html).toContain('foo');
    expect(html).toContain('```js');
  });
});

// ── Callout with code blocks ─────────────────────────────────────────

describe('callout with code blocks', () => {
  it('backtick code block inside callout renders correctly', () => {
    const md = '> [!note] Example\n> ```js\n> const x = 1;\n> ```';
    const html = preprocessCallouts(md);
    expect(html).toContain('callout-note');
    expect(html).toContain('const x = 1;');
  });

  it('tilde code block inside callout renders correctly', () => {
    const md = '> [!note] Example\n> ~~~sql\n> SELECT 1;\n> ~~~';
    const html = preprocessCallouts(md);
    expect(html).toContain('callout-note');
    expect(html).toContain('SELECT 1;');
  });
});

// ── CRLF line endings ────────────────────────────────────────────────

describe('Windows CRLF line endings', () => {
  it('backtick fence with \\r\\n', () => {
    const html = renderMarkdown('```js\r\nconsole.log(1)\r\n```');
    expect(html).toContain('code-block');
  });

  it('tilde fence with \\r\\n', () => {
    const html = renderMarkdown('~~~sql\r\nSELECT 1\r\n~~~');
    expect(html).toContain('hljs-keyword');
  });

  it('callout with \\r\\n', () => {
    const html = renderMarkdown('> [!note]\r\n> Hello');
    expect(html).toContain('callout-note');
  });

  it('wikilink with \\r\\n', () => {
    const html = renderMarkdown('[[Page]]\r\n');
    expect(html).toContain('/vault/');
  });

  it('footnote with \\r\\n', () => {
    const html = renderMarkdown('Ref[^1]\r\n\r\n[^1]: Def');
    expect(html).toContain('footnote-ref');
  });

  it('code block isolation with \\r\\n', () => {
    const md = '```markdown\r\nThis [[no]] link\r\n```\r\nAfter';
    const html = preprocessWikilinks(md);
    expect(html).not.toContain('/vault/');
  });
});

// ── Regression: existing features still work ─────────────────────────

describe('regression', () => {
  it('basic backtick code block', () => {
    const html = renderMarkdown('```js\nconsole.log("hello")\n```');
    expect(html).toContain('code-block');
    expect(html).toContain('hljs');
  });

  it('mermaid block', () => {
    const html = renderMarkdown('```mermaid\ngraph TD\n  A-->B\n```');
    expect(html).toContain('mermaid-block');
  });

  it('inline math', () => {
    const html = renderMarkdown('$x^2$');
    expect(html).toContain('x^2');
  });

  it('block math', () => {
    const html = renderMarkdown('$$\n\\int_0^1 f(x) dx\n$$');
    expect(html).toContain('\\int');
  });

  it('wikilink with alias', () => {
    const html = renderMarkdown('[[Page|Display]]');
    expect(html).toContain('/vault/');
    expect(html).toContain('Display');
  });

  it('callout rendering', () => {
    const html = renderMarkdown('> [!warning]\n> Danger!');
    expect(html).toContain('callout-warning');
    expect(html).toContain('Danger!');
  });

  it('nested callouts — inner callout rendered as blockquote (known limitation)', () => {
    // NOTE: > > [!type] nested callouts are NOT currently supported.
    // The inner callout is rendered as a blockquote, not a callout div.
    const md = '> [!note] Outer\n> Content\n>\n> > [!warning] Inner\n> > Inner content';
    const html = renderMarkdown(md);
    expect(html).toContain('callout-note');
    expect(html).toContain('<blockquote');
  });

  it('footnote with multiline definition', () => {
    const md = 'Text[^1].\n\n[^1]: First line\n  continuation line';
    const html = renderMarkdown(md);
    expect(html).toContain('footnote-ref');
    expect(html).toContain('footnotes');
  });

  it('task list', () => {
    const html = renderMarkdown('- [x] Done\n- [ ] Todo');
    expect(html).toContain('task-list');
  });

  it('table', () => {
    const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table');
  });

  it('frontmatter is parsed and stripped', () => {
    const result = parseFrontmatter('---\ntitle: Test\n---\nBody');
    expect(result.frontmatter).toEqual({ title: 'Test' });
    expect(result.body).toBe('Body');
  });
});

// ── PR #2: SVG/style raw tag skip ────────────────────────────────────

describe('SVG/style tag skip in preprocessTags', () => {
  it('tags inside <svg> block are not processed', () => {
    const md = '<svg>\n<circle fill="#ff0000" />\n</svg>\n#real-tag';
    const html = preprocessTags(md);
    expect(html).not.toContain('#ff0000</span>'); // hex color NOT a tag
    expect(html).toContain('class="tag">#real-tag</span>'); // real tag after svg
  });

  it('tags inside <style> block are not processed', () => {
    const md = '<style>\n.btn { color: #2563eb; }\n</style>\n#real-tag';
    const html = preprocessTags(md);
    expect(html).not.toContain('#2563eb</span>'); // hex color untouched
    expect(html).toContain('class="tag">#real-tag</span>');
  });

  it('self-closing svg is not treated as block', () => {
    const md = '<svg />\n#real-tag';
    const html = preprocessTags(md);
    expect(html).toContain('class="tag">#real-tag</span>');
  });

  it('<svg> inside inline code does NOT trigger raw tag skip', () => {
    const md = '`<svg>` #tag should render';
    const html = preprocessTags(md);
    expect(html).toContain('class="tag">#tag</span>');
  });

  it('<style> inside inline code does NOT trigger raw tag skip', () => {
    const md = '`<style>` #tag should render';
    const html = preprocessTags(md);
    expect(html).toContain('class="tag">#tag</span>');
  });
});

// ── PR #2: Embed meta parsing ────────────────────────────────────────

describe('embed meta parsing', () => {
  it('image embed with size', () => {
    const html = preprocessEmbeds('![[photo.png|200x100]]', new Set());
    expect(html).toContain('width="200"');
    expect(html).toContain('height="100"');
  });

  it('image embed with alt text', () => {
    const html = preprocessEmbeds('![[photo.png|My Photo]]', new Set());
    expect(html).toContain('alt="My Photo"');
  });

  it('SVG embed treated as image', () => {
    const html = preprocessEmbeds('![[icon.svg]]', new Set());
    expect(html).toContain('embed-image');
    expect(html).toContain('img src');
  });

  it('markdown embed is placeholder', () => {
    const html = preprocessEmbeds('![[note]]', new Set());
    expect(html).toContain('embed-markdown');
    expect(html).toContain('data-embed-path');
  });
});
