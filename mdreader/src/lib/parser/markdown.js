import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';

/**
 * @type {MarkdownIt}
 */
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  /**
   * @param {string} str
   * @param {string} lang
   * @returns {string}
   */
  highlight: (str, lang) => {
    // Preserve mermaid blocks for later processing — don't highlight them
    if (lang === 'mermaid') {
      return `<pre class="mermaid-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs code-block"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch (e) {
        console.error('Highlight error:', e);
      }
    }
    return `<pre class="hljs code-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  }
});

// Enable GFM task lists (- [x] / - [ ])
md.use(taskLists, { enabled: true, label: true });

// Wikilink regex: [[Page]] or [[Page|Alias]] or [[Page#Heading]]
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Callout regex: > [!note] or > [!note] Title or > [!note]+ or > [!note]-
const CALLOUT_REGEX = /^>\s*\[!(\w+)\]([+-])?\s*(.*)$/;

// Footnote regex: [^1] or [^note]
const FOOTNOTE_REF_REGEX = /\[\^([^\]]+)\]/g;

// Tag regex: #tag or #nested/tag
const TAG_REGEX = /(?:^|\s)#([\w\-\/]+)/g;

// Embed regex: ![[file]] or !![[note.md]]
const EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;

/** Escape HTML special characters to prevent injection via filenames
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} content
 * @param {Set<string>} embedChain
 * @returns {string}
 */
export function preprocessEmbeds(content, embedChain = new Set()) {
  return content.replace(EMBED_REGEX, (match, embedPath) => {
    // Normalize path for cycle detection
    const normalizedPath = embedPath.replace(/\\/g, '/');
    if (embedChain.has(normalizedPath)) {
      return `<div class="embed-error">Circular embed detected: ${escapeHtml(embedPath)}</div>`;
    }

    // Mark this file as being embedded
    embedChain.add(normalizedPath);

    const safePath = escapeHtml(embedPath);

    // Determine if it's an image or markdown
    if (embedPath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
      // Image embed
      return `<div class="embed-image"><img src="${safePath}" alt="${safePath}" /></div>`;
    } else {
      // Markdown embed placeholder - will be resolved later
      return `<div class="embed-markdown" data-embed-path="${safePath}"><span class="embed-loading">Loading ${safePath}...</span></div>`;
    }
  });
}

/**
 * @param {string} content
 * @returns {string}
 */
export function preprocessTags(content) {
  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    // Skip code blocks
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    // Skip tags inside inline code (backtick-delimited segments)
    // Split line by inline code spans, only process non-code parts
    const parts = line.split(/(`[^`]+`)/);
    const processed = parts.map((part, idx) => {
      // Odd indices are inline code spans — pass through unchanged
      if (idx % 2 === 1) return part;
      return part.replace(TAG_REGEX, (match, tag) => {
        // Skip common programming tokens like #include, #define, #ifdef, etc.
        if (/^(include|define|ifdef|ifndef|endif|pragma|undef|if|else|elif|error|warning|line)$/i.test(tag)) {
          return match;
        }
        return `${match.slice(0, -tag.length - 1)}<span class="tag">#${tag}</span>`;
      });
    });
    result.push(processed.join(''));
  }

  return result.join('\n');
}

// Callout type icons
/** @type {Record<string, string>} */
const CALLOUT_ICONS = {
  note: 'ℹ️',
  info: 'ℹ️',
  warning: '⚠️',
  caution: '⚠️',
  danger: '🔴',
  tip: '💡',
  hint: '💡',
  important: '🔥',
  example: '📋',
  quote: '💬',
  cite: '💬',
  abstract: '📘',
  summary: '📘',
  tldr: '📘',
  todo: '✅',
  success: '✅',
  check: '✅',
  done: '✅',
  question: '❓',
  help: '❓',
  faq: '❓',
  failure: '❌',
  fail: '❌',
  missing: '❌',
  bug: '🐛',
  formula: '📐',
  math: '📐'
};

/**
 * @param {string} content
 * @returns {string}
 */
export function preprocessCallouts(content) {
  const lines = content.split('\n');
  const result = [];
  let inCallout = false;
  let calloutType = '';
  let calloutDepth = 0;
  let pendingEmptyLines = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks — don't process anything inside them
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCallout) {
        // Code fence inside a callout: strip leading '> ' if present
        if (line.startsWith('> ')) {
          result.push(line.substring(2));
        } else if (line.startsWith('>')) {
          result.push(line.substring(1));
        } else {
          // Code fence without '>' ends the callout
          for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
          inCallout = false;
          calloutDepth = 0;
          pendingEmptyLines = 0;
          result.push(line);
        }
      } else {
        result.push(line);
      }
      continue;
    }

    if (inCodeBlock) {
      // Inside a code block — pass through, but strip '> ' if in callout
      if (inCallout) {
        if (line.startsWith('> ')) {
          result.push(line.substring(2));
        } else if (line.startsWith('>')) {
          result.push(line.substring(1));
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
      continue;
    }

    const calloutMatch = line.match(CALLOUT_REGEX);

    if (!inCallout && calloutMatch) {
      inCallout = true;
      calloutType = calloutMatch[1].toLowerCase();
      const title = calloutMatch[3] || calloutType;
      calloutDepth = 1;
      pendingEmptyLines = 0;
      const icon = CALLOUT_ICONS[calloutType] || 'ℹ️';
      result.push(`<div class="callout callout-${calloutType}">`);
      result.push(`<div class="callout-title"><span class="callout-icon">${icon}</span> ${title}</div>`);
      result.push(`<div class="callout-content">\n`);
    } else if (inCallout) {
      // Check for nested callout inside the current one
      const nestedMatch = line.match(/^>\s*\[!(\w+)\]([+-])?\s*(.*)$/);
      if (nestedMatch && line.startsWith('> ')) {
        for (let j = 0; j < pendingEmptyLines; j++) result.push('');
        pendingEmptyLines = 0;
        const nestedType = nestedMatch[1].toLowerCase();
        const nestedTitle = nestedMatch[3] || nestedType;
        const nestedIcon = CALLOUT_ICONS[nestedType] || 'ℹ️';
        calloutDepth++;
        result.push(`<div class="callout callout-${nestedType}">`);
        result.push(`<div class="callout-title"><span class="callout-icon">${nestedIcon}</span> ${nestedTitle}</div>`);
        result.push(`<div class="callout-content">`);
      } else if (line.startsWith('> ')) {
        for (let j = 0; j < pendingEmptyLines; j++) result.push('');
        pendingEmptyLines = 0;
        result.push(line.substring(2));
      } else if (line.startsWith('>')) {
        for (let j = 0; j < pendingEmptyLines; j++) result.push('');
        pendingEmptyLines = 0;
        result.push(line.substring(1));
      } else if (line.trim() === '') {
        // Empty line (not starting with '>') ends the callout — matches Obsidian behavior
        for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
        inCallout = false;
        calloutDepth = 0;
        pendingEmptyLines = 0;
        result.push(line);
      } else {
        for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
        inCallout = false;
        calloutDepth = 0;
        pendingEmptyLines = 0;
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  if (inCallout) {
    for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
  }

  return result.join('\n');
}

/**
 * @param {string} content
 * @returns {string}
 */
export function preprocessWikilinks(content) {
  return content.replace(WIKILINK_REGEX, (match, page, alias) => {
    const displayText = alias || page;
    const parts = page.split('#');
    const pageName = parts[0];
    const heading = parts[1] || '';

    const encodedPage = encodeURIComponent(pageName);
    const linkPath = heading ? `/vault/${encodedPage}#${encodeURIComponent(heading)}` : `/vault/${encodedPage}`;

    return `[${displayText}](${linkPath})`;
  });
}

/**
 * @param {string} content
 * @returns {string}
 */
export function preprocessFootnotes(content) {
  const footnoteRefs = new Map();
  const footnoteDefs = new Map();
  const lines = content.split('\n');
  const result = [];

  // First pass: collect all footnote definitions
  for (const line of lines) {
    const defMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (defMatch) {
      footnoteDefs.set(defMatch[1], defMatch[2]);
    }
  }

  // Second pass: process content and collect references
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip footnote definition lines
    if (/^\[\^[^\]]+\]:/.test(line)) {
      continue;
    }

    // Replace footnote references with superscript spans
    const processedLine = line.replace(FOOTNOTE_REF_REGEX, (match, id) => {
      if (footnoteDefs.has(id)) {
        footnoteRefs.set(id, true);
        return `<sup class="footnote-ref" data-footnote-id="${id}">[${id}]</sup>`;
      }
      return match;
    });

    result.push(processedLine);
  }

  // Build footnotes section at the end
  const footnotes = [];
  for (const [id] of footnoteRefs) {
    const def = footnoteDefs.get(id);
    if (def) {
      footnotes.push(`<li id="footnote-${id}"><sup>[${id}]</sup> ${def}</li>`);
    }
  }

  if (footnotes.length > 0) {
    result.push('');
    result.push('<div class="footnotes">');
    result.push('<hr>');
    result.push('<ol>');
    result.push(...footnotes);
    result.push('</ol>');
    result.push('</div>');
  }

  return result.join('\n');
}

/**
 * @param {string} content
 * @returns {{frontmatter: object|null, body: string}}
 */
export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length);

  /** @type {Record<string, any>} */
  const frontmatter = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      /** @type {string} */
      let value = line.slice(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        const arr = value.slice(1, -1).split(',').map(/** @param {string} v */ v => v.trim());
        value = arr.join(',');
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Protect math expressions from markdown-it.
 * markdown-it treats \{ \} etc. as CommonMark backslash escapes and strips
 * the backslash, which breaks LaTeX like \left\{ ... \right\}.
 * We replace $...$ / $$...$$ with placeholders before md.render(), then
 * restore them afterwards.
 * @param {string} content
 * @returns {{ text: string, mathBlocks: string[] }}
 */
function shieldMath(content) {
  /** @type {string[]} */
  const mathBlocks = [];
  const BLOCK_MATH = /\$\$([\s\S]*?)\$\$/g;
  const INLINE_MATH = /(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g;

  // First shield block math ($$...$$) — order matters
  // NOTE: Use \x01 (SOH) instead of \x00 (NUL) because markdown-it replaces
  // NUL bytes with U+FFFD per CommonMark spec, breaking unshieldMath().
  let shielded = content.replace(BLOCK_MATH, (match) => {
    const idx = mathBlocks.length;
    mathBlocks.push(match);
    return `\x01MATH${idx}\x01`;
  });

  // Then shield inline math ($...$)
  shielded = shielded.replace(INLINE_MATH, (match) => {
    const idx = mathBlocks.length;
    mathBlocks.push(match);
    return `\x01MATH${idx}\x01`;
  });

  return { text: shielded, mathBlocks };
}

/**
 * Restore shielded math expressions after markdown-it rendering.
 * The placeholders survive md.render() because they contain no markdown syntax.
 * @param {string} html
 * @param {string[]} mathBlocks
 * @returns {string}
 */
function unshieldMath(html, mathBlocks) {
  return html.replace(/\x01MATH(\d+)\x01/g, (_, idx) => {
    return mathBlocks[Number(idx)];
  });
}

/**
 * Escape HTML-special characters inside math expressions so DOMPurify
 * doesn't strip them (e.g. "$-1 < x < 1$" — the "< x <" looks like an
 * HTML tag to the sanitizer).
 * After DOMPurify the entities survive; the browser decodes them back via
 * innerHTML, and KaTeX reads the correct characters from textContent.
 * @param {string} html
 * @returns {string}
 */
function escapeMathHtml(html) {
  return html.replace(/(\$\$?)([\s\S]*?)\1/g, (match, delim, body) => {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return delim + escaped + delim;
  });
}

/**
 * @param {string} content
 * @returns {string}
 */
export function renderMarkdown(content) {
  let processed = preprocessCallouts(content);
  processed = preprocessEmbeds(processed);
  processed = preprocessWikilinks(processed);
  processed = preprocessFootnotes(processed);
  processed = preprocessTags(processed);

  // Shield math from markdown-it's backslash-escape processing
  const { text: shielded, mathBlocks } = shieldMath(processed);
  let html = md.render(shielded);
  html = unshieldMath(html, mathBlocks);
  // Escape < / > inside math so DOMPurify won't strip them
  html = escapeMathHtml(html);
  return html;
}

/**
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
export function highlightCode(code, language) {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language }).value;
    } catch (e) {
      console.error('Highlight error:', e);
    }
  }
  return md.utils.escapeHtml(code);
}

export default md;