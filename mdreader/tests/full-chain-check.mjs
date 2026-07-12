import fs from 'fs';
import path from 'path';
import {
  renderMarkdown, preprocessCallouts, preprocessEmbeds,
  preprocessWikilinks, preprocessFootnotes, preprocessTags,
  parseFrontmatter, highlightCode
} from '../src/lib/parser/markdown.js';

const sampleDir = path.resolve(import.meta.dirname, '../sample');
const samples = fs.readdirSync(sampleDir).filter(f => f.endsWith('.md'));
let total = 0, pass = 0, fail = 0;
const failures = [];

function check(name, ok) {
  total++;
  if (ok) { pass++; }
  else { fail++; failures.push(name); }
}

// ── 1. Each sample file renders fully ──
console.log('=== 1. Sample file full render ===');
for (const file of samples) {
  const content = fs.readFileSync(path.join(sampleDir, file), 'utf8');
  try {
    const html = renderMarkdown(content);
    check(file + ' renders', html.length > 0);
    console.log('  ✅ ' + file + ' (' + html.length + ' chars)');
  } catch (e) {
    check(file + ' renders', false);
    console.log('  ❌ ' + file + ': ' + e.message);
  }
}

// ── 2. Preprocessor isolation ──
console.log('\n=== 2. Preprocessor isolation ===');
const codeSamples = [
  ['backtick',   '```\n[[link]] #tag ![[embed]] [^1]\n```'],
  ['tilde',      '~~~\n[[link]] #tag ![[embed]] [^1]\n~~~'],
  ['5-backtick', '`````\n[[link]] #tag ![[embed]] [^1]\n`````'],
  ['indented3',  '   ```\n[[link]] #tag ![[embed]] [^1]\n   ```'],
  ['CRLF',       '```\r\n[[link]] #tag ![[embed]] [^1]\r\n```'],
  ['mixed',      '~~~\n``` inside\n[[link]] #tag\n~~~'],
];

for (const [label, md] of codeSamples) {
  check(label + ': wikilinks untouched', !preprocessWikilinks(md).includes('/vault/'));
  check(label + ': tags untouched',      !preprocessTags(md).includes('class="tag"'));
  check(label + ': embeds untouched',    !preprocessEmbeds(md, new Set()).includes('embed-'));
  check(label + ': footnotes untouched', !preprocessFootnotes(md).includes('footnote-ref'));
  check(label + ': callouts untouched',  !preprocessCallouts(md).includes('class="callout'));
}

// ── 3. Fence detection — exhaustive ──
console.log('\n=== 3. Fence detection ===');
const fenceTests = [
  ['```\ncode\n```',                     true,  'basic 3-backtick'],
  ['````\ncode\n````',                   true,  '4-backtick'],
  ['~~~\ncode\n~~~',                     true,  '3-tilde'],
  ['~~~~\ncode\n~~~~',                   true,  '4-tilde'],
  ['```sql\nSELECT 1\n```',             true,  'backtick+lang'],
  ['~~~sql\nSELECT 1\n~~~',             true,  'tilde+lang'],
  ['```\ncode\n````',                    true,  'close with more backticks'],
  ['~~~~\ncode\n~~~',                    true,  'close with fewer tilde — open still creates block, close ignored'],
  ['~~~\ncode\n```\n~~~',               true,  'wrong close char (backtick for tilde) — content until valid close'],
  ['```\ncode\n~~~',                     true,  'wrong close char (tilde for backtick) — no valid close, all content'],
  ['    ```\ncode\n    ```',            false, '4-space indent (not a fence)'],
  ['   ```\ncode\n   ```',              true,  '3-space indent (valid fence)'],
  ['```\n```js\n```',                    true,  'info string on close = content'],
];

for (const [input, expectCode, label] of fenceTests) {
  const html = renderMarkdown(input);
  const hasCode = html.includes('code-block');
  check('fence: ' + label, hasCode === expectCode);
}

// ── 4. Smoke-test.md features ──
console.log('\n=== 4. Smoke-test.md features ===');
const smoke = fs.readFileSync(path.join(sampleDir, 'smoke-test.md'), 'utf8');
const smokeHtml = renderMarkdown(smoke);
const smokeChecks = [
  ['code-block',                    smokeHtml.includes('code-block')],
  ['mermaid-block',                 smokeHtml.includes('mermaid-block')],
  ['callout-note',                  smokeHtml.includes('callout-note')],
  ['callout-warning',               smokeHtml.includes('callout-warning')],
  ['callout-tip',                   smokeHtml.includes('callout-tip')],
  ['callout-info',                  smokeHtml.includes('callout-info')],
  ['callout-danger',                smokeHtml.includes('callout-danger')],
  ['callout-important',             smokeHtml.includes('callout-important')],
  ['callout-example',               smokeHtml.includes('callout-example')],
  ['callout-quote',                 smokeHtml.includes('callout-quote')],
  ['wikilink /vault/',              smokeHtml.includes('/vault/')],
  ['wikilink alias',                smokeHtml.includes('Display Text')],
  ['embed placeholder',             smokeHtml.includes('embed-')],
  ['footnote-ref',                  smokeHtml.includes('footnote-ref')],
  ['footnotes div',                 smokeHtml.includes('class="footnotes"')],
  ['tag class',                     smokeHtml.includes('class="tag"')],
  ['table',                         smokeHtml.includes('<table')],
  ['task-list',                     smokeHtml.includes('task-list')],
  ['blockquote',                    smokeHtml.includes('<blockquote')],
  ['h1 heading',                    smokeHtml.includes('<h1')],
  ['h2 heading',                    smokeHtml.includes('<h2')],
  ['strikethrough',                 smokeHtml.includes('<s>')],
  ['inline code',                   smokeHtml.includes('<code>')],
  ['hljs highlight',                smokeHtml.includes('hljs')],
  ['<hr> divider',                  smokeHtml.includes('<hr')],
  ['ordered list',                  smokeHtml.includes('<ol')],
  ['no wikilink in code', (() => {
    const parts = smokeHtml.split('code-block');
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].split('</pre>')[0].includes('/vault/')) return false;
    }
    return true;
  })()],
  ['no tag in code', (() => {
    const parts = smokeHtml.split('code-block');
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].split('</pre>')[0].includes('class="tag"')) return false;
    }
    return true;
  })()],
];
for (const [name, ok] of smokeChecks) check('smoke: ' + name, ok);

// ── 5. CRLF end-to-end ──
console.log('\n=== 5. CRLF end-to-end ===');
const crlfMd = '---\r\ntitle: Test\r\n---\r\n# Hello\r\n\r\n[[Page]] #tag ![[img.png]]\r\n\r\n> [!note]\r\n> Content\r\n\r\n```js\r\nconsole.log(1)\r\n```\r\n\r\n~~~sql\r\nSELECT 1\r\n~~~\r\n\r\n[^1] ref\r\n\r\n[^1]: Def';
const crlfHtml = renderMarkdown(crlfMd);
check('CRLF: frontmatter',  crlfHtml.includes('Hello'));
check('CRLF: wikilink',     crlfHtml.includes('/vault/'));
check('CRLF: tag',          crlfHtml.includes('class="tag"'));
check('CRLF: callout',      crlfHtml.includes('callout-note'));
check('CRLF: backtick code',crlfHtml.includes('code-block'));
check('CRLF: tilde code',   crlfHtml.includes('hljs-keyword'));
check('CRLF: footnote',     crlfHtml.includes('footnote-ref'));

// ── 6. PR #2 features ──
console.log('\n=== 6. PR #2 features ===');
check('PR2: SVG embed',      preprocessEmbeds('![[icon.svg]]', new Set()).includes('embed-image'));
check('PR2: embed size',     preprocessEmbeds('![[img.png|200x100]]', new Set()).includes('width="200"'));
check('PR2: embed alt',      preprocessEmbeds('![[img.png|Alt]]', new Set()).includes('alt="Alt"'));
check('PR2: svg tag skip',   !preprocessTags('<svg>\n.fill #fff\n</svg>').includes('#fff</span>'));
check('PR2: style tag skip', !preprocessTags('<style>\n.btn { color: #2563eb; }\n</style>').includes('#2563eb</span>'));

// ── 7. highlightCode ──
console.log('\n=== 7. highlightCode ===');
const hl = highlightCode('SELECT * FROM users', 'sql');
check('highlightCode: works', hl.length > 0 && hl !== 'SELECT * FROM users');

// ── Summary ──
console.log('\n' + '='.repeat(50));
console.log('Total: ' + total + '  Pass: ' + pass + '  Fail: ' + fail);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  ❌ ' + f));
  process.exit(1);
} else {
  console.log('\n✅ ALL CHECKS PASSED');
}
