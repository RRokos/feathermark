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

const RAW_TAG_SKIP_REGEX = /<\s*(svg|style)(?=[\s>])/i;

/**
 * @param {string} line
 * @returns {string|null}
 */
function getRawTagToSkip(line) {
  const match = line.match(RAW_TAG_SKIP_REGEX);
  return match ? match[1].toLowerCase() : null;
}

/**
 * @param {string} line
 * @param {string} tag
 * @returns {boolean}
 */
function closesRawTag(line, tag) {
  return new RegExp(`<\\s*\\/\\s*${tag}\\s*>`, 'i').test(line);
}

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
 * @param {string} embedPath
 * @returns {{ target: string, meta: string }}
 */
function splitEmbedTarget(embedPath) {
  const pipeIndex = embedPath.indexOf('|');
  if (pipeIndex < 0) {
    return { target: embedPath.trim(), meta: '' };
  }
  return {
    target: embedPath.slice(0, pipeIndex).trim(),
    meta: embedPath.slice(pipeIndex + 1).trim()
  };
}

/**
 * @param {string} target
 * @returns {string}
 */
function stripResourceSuffix(target) {
  const queryIndex = target.indexOf('?');
  const hashIndex = target.indexOf('#');
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const suffixIndex = indexes.length > 0 ? Math.min(...indexes) : -1;
  return suffixIndex < 0 ? target : target.slice(0, suffixIndex);
}

/**
 * @param {string} target
 * @returns {boolean}
 */
function isImageEmbedTarget(target) {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(stripResourceSuffix(target));
}

/**
 * @param {string} meta
 * @returns {{ alt: string, width: string, height: string }}
 */
function parseImageEmbedMeta(meta) {
  const trimmed = meta.trim();
  if (!trimmed) return { alt: '', width: '', height: '' };

  const size = trimmed.match(/^(\d{1,4})(?:\s*x\s*(\d{1,4}))?$/i);
  if (size) {
    return {
      alt: '',
      width: size[1],
      height: size[2] || ''
    };
  }

  return { alt: trimmed, width: '', height: '' };
}

/**
 * @param {string} content
 * @param {Set<string>} embedChain
 * @returns {string}
 */
export function preprocessEmbeds(content, embedChain) {
  if (!embedChain) embedChain = new Set();

  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    result.push(line.replace(EMBED_REGEX, (match, embedPath) => {
      const { target, meta } = splitEmbedTarget(embedPath);
      if (!target) return match;

      // Image embeds are leaf resources, so repeated images should render
      // normally instead of being treated as circular Markdown embeds.
      if (isImageEmbedTarget(target)) {
        const safePath = escapeHtml(target);
        const imageMeta = parseImageEmbedMeta(meta);
        const alt = escapeHtml(imageMeta.alt || target);
        const width = imageMeta.width ? ` width="${imageMeta.width}"` : '';
        const height = imageMeta.height ? ` height="${imageMeta.height}"` : '';
        return `<div class="embed-image"><img src="${safePath}" alt="${alt}"${width}${height} /></div>`;
      }

      // Normalize path for cycle detection
      const normalizedPath = target.replace(/\\/g, '/');
      if (embedChain.has(normalizedPath)) {
        return `<div class="embed-error">Circular embed detected: ${escapeHtml(target)}</div>`;
      }

      // Mark this file as being embedded
      embedChain.add(normalizedPath);

      const safePath = escapeHtml(target);

      // Markdown embed placeholder - will be resolved later
      return `<div class="embed-markdown" data-embed-path="${safePath}"><span class="embed-loading">Loading ${safePath}...</span></div>`;
    }));
  }

  return result.join('\n');
}

/**
 * @param {string} content
 * @returns {string}
 */
export function preprocessTags(content) {
  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;
  let rawTagToSkip = null;

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

    if (rawTagToSkip) {
      result.push(line);
      if (closesRawTag(line, rawTagToSkip)) {
        rawTagToSkip = null;
      }
      continue;
    }

    const rawTag = getRawTagToSkip(line);
    if (rawTag) {
      result.push(line);
      if (!closesRawTag(line, rawTag) && !/\/\s*>/.test(line)) {
        rawTagToSkip = rawTag;
      }
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
  let inCodeBlock = false;
  // Track code blocks INSIDE callouts separately — the '> ' prefix
  // breaks `trimStart().startsWith('```')` detection, so we track
  // fences on the stripped line within callout context.
  let inCalloutCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Outside callout ─────────────────────────────────────────────
    if (!inCallout) {
      // Track fenced code blocks — don't process callout syntax inside them
      if (line.trimStart().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(line);
        continue;
      }

      if (inCodeBlock) {
        // Inside a code block — pass through unchanged
        result.push(line);
        continue;
      }

      // Not in a code block — check for callout start
      const calloutMatch = line.match(CALLOUT_REGEX);
      if (calloutMatch) {
        inCallout = true;
        calloutType = calloutMatch[1].toLowerCase();
        const title = calloutMatch[3] || calloutType;
        calloutDepth = 1;
        inCalloutCodeBlock = false;
        const icon = CALLOUT_ICONS[calloutType] || 'ℹ️';
        result.push(`<div class="callout callout-${calloutType}">`);
        result.push(`<div class="callout-title"><span class="callout-icon">${icon}</span> ${title}</div>`);
        result.push(`<div class="callout-content">\n`);
      } else {
        result.push(line);
      }
      continue;
    }

    // ── Inside callout ──────────────────────────────────────────────

    // Count blockquote nesting level (> = 1, > > = 2, etc.)
    let nestingLevel = 0;
    let tempLine = line;
    while (tempLine.startsWith('> ')) {
      nestingLevel++;
      tempLine = tempLine.substring(2);
    }
    if (tempLine.startsWith('>')) {
      nestingLevel++;
      tempLine = tempLine.substring(1);
    }

    // If nesting level dropped, close inner callouts to match
    // e.g. was at depth 2, now at level 1 → close 1 inner callout
    if (nestingLevel > 0 && nestingLevel < calloutDepth && calloutDepth > 1) {
      const toClose = calloutDepth - nestingLevel;
      for (let d = 0; d < toClose; d++) {
        result.push('\n</div></div>');
        calloutDepth--;
      }
    }

    // Strip '> ' prefix for lines that have it
    const stripped = line.startsWith('> ') ? line.substring(2)
                    : line.startsWith('>') ? line.substring(1)
                    : null;

    // Check for code fence on the stripped line (handles ``` inside callouts)
    if (stripped !== null && stripped.trimStart().startsWith('```')) {
      inCalloutCodeBlock = !inCalloutCodeBlock;
      result.push(stripped);
      continue;
    }

    // Inside a code block within the callout — pass stripped line through
    if (inCalloutCodeBlock) {
      if (stripped !== null) {
        result.push(stripped);
      } else {
        result.push(line);
      }
      continue;
    }

    // Check for nested callout (only if line starts with '> ')
    const nestedMatch = line.match(/^>\s*\[!(\w+)\]([+-])?\s*(.*)$/);
    if (nestedMatch && line.startsWith('> ') && nestingLevel <= calloutDepth) {
      const nestedType = nestedMatch[1].toLowerCase();
      const nestedTitle = nestedMatch[3] || nestedType;
      const nestedIcon = CALLOUT_ICONS[nestedType] || 'ℹ️';
      calloutDepth++;
      result.push(`<div class="callout callout-${nestedType}">`);
      result.push(`<div class="callout-title"><span class="callout-icon">${nestedIcon}</span> ${nestedTitle}</div>`);
      result.push(`<div class="callout-content">`);
    } else if (stripped !== null) {
      // Regular callout content line
      result.push(stripped);
    } else if (line.trim() === '') {
      // Empty line (not starting with '>') ends the callout — matches Obsidian behavior
      for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
      inCallout = false;
      calloutDepth = 0;
      inCalloutCodeBlock = false;
      result.push(line);
    } else {
      // Non-empty line without '> ' prefix ends the callout
      for (let d = 0; d < calloutDepth; d++) result.push('\n</div></div>');
      inCallout = false;
      calloutDepth = 0;
      inCalloutCodeBlock = false;
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
  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    // Split by inline code spans, only process non-code parts (like preprocessTags)
    const parts = line.split(/(`[^`]+`)/);
    const processed = parts.map((part, idx) => {
      if (idx % 2 === 1) return part; // inline code — pass through
      return part.replace(WIKILINK_REGEX, (match, page, alias) => {
        const displayText = alias || page;
        const parts = page.split('#');
        const pageName = parts[0];
        const heading = parts[1] || '';

        const encodedPage = pageName.split('/').map(s => encodeURIComponent(s)).join('/');
        const linkPath = heading ? `/vault/${encodedPage}#${encodeURIComponent(heading)}` : `/vault/${encodedPage}`;

        return `[${displayText}](${linkPath})`;
      });
    });
    result.push(processed.join(''));
  }

  return result.join('\n');
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

  // First pass: collect all footnote definitions (skip inside code blocks)
  // Supports multi-line definitions (continuation lines indented with 2+ spaces or 1 tab)
  {
    let inCodeBlock = false;
    let currentId = null;
    let currentText = '';
    for (const line of lines) {
      if (line.trimStart().startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
      if (inCodeBlock) continue;

      const defMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
      if (defMatch) {
        // Save previous definition if any
        if (currentId) {
          footnoteDefs.set(currentId, currentText.trim());
        }
        currentId = defMatch[1];
        currentText = defMatch[2];
      } else if (currentId && /^(?:  |\t)/.test(line)) {
        // Continuation line (indented with 2+ spaces or tab) — append to definition
        currentText += ' ' + line.trim();
      } else {
        // Not a continuation — save and reset
        if (currentId) {
          footnoteDefs.set(currentId, currentText.trim());
          currentId = null;
          currentText = '';
        }
      }
    }
    // Save last definition
    if (currentId) {
      footnoteDefs.set(currentId, currentText.trim());
    }
  }

  // Second pass: process content and collect references
  let inCodeBlock = false;
  let skipContinuation = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      skipContinuation = false;
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Skip footnote definition lines
    if (/^\[\^[^\]]+\]:/.test(line)) {
      skipContinuation = true;
      continue;
    }

    // Skip continuation lines of footnote definitions
    if (skipContinuation && /^(?:  |\t)/.test(line)) {
      continue;
    }
    skipContinuation = false;

    // Replace footnote references with superscript spans (skip inline code)
    const parts = line.split(/(`[^`]+`)/);
    const processed = parts.map((part, idx) => {
      if (idx % 2 === 1) return part; // inline code — pass through
      return part.replace(FOOTNOTE_REF_REGEX, (match, id) => {
        if (footnoteDefs.has(id)) {
          footnoteRefs.set(id, true);
          const safeId = escapeHtml(id);
          return `<sup class="footnote-ref" data-footnote-id="${safeId}">[${safeId}]</sup>`;
        }
        return match;
      });
    });
    result.push(processed.join(''));
  }

  // Build footnotes section at the end
  // Render footnote definitions through markdown-it for inline formatting
  const footnotes = [];
  for (const [id] of footnoteRefs) {
    const def = footnoteDefs.get(id);
    if (def) {
      const safeId = escapeHtml(id);
      // Use markdown-it to render inline formatting (bold, italic, code, links)
      const renderedDef = md.renderInline(def);
      footnotes.push(`<li id="footnote-${safeId}"><sup>[${safeId}]</sup> ${renderedDef}</li>`);
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
  processed = preprocessEmbeds(processed, new Set());
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
