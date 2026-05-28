import 'katex/dist/katex.min.css';
import katex from 'katex';

/** Custom macros for commands not built into KaTeX */
const KATEX_MACROS = {
  '\\arccot': '\\operatorname{arccot}',
  '\\arcsec': '\\operatorname{arcsec}',
  '\\arccsc': '\\operatorname{arccsc}',
};

/**
 * @param {string} latex
 * @param {object} [options]
 * @returns {string}
 */
export function renderKatex(latex, options = {}) {
  const defaultOptions = {
    displayMode: false,
    throwOnError: false,
    errorColor: '#cc0000',
    strict: false,
    trust: false,
    macros: KATEX_MACROS,
    ...options
  };

  try {
    return katex.renderToString(latex, defaultOptions);
  } catch (/** @type {any} */ error) {
    console.error('KaTeX render error:', error);
    return `<span class="katex-error">${error.message}</span>`;
  }
}

/**
 * Walk all text nodes in a container and replace $...$ and $$...$$ with rendered KaTeX.
 * Operates on the DOM directly to avoid corrupting HTML attributes.
 * @param {HTMLElement} container
 * @returns {void}
 */
export function renderMathInDOM(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const parent = node.parentNode;
    if (!parent) continue;

    // Skip nodes inside <code>, <pre>, <script>, <style>, <svg>
    const tag = parent.nodeName.toLowerCase();
    if (tag === 'code' || tag === 'pre' || tag === 'script' || tag === 'style' || tag === 'svg') continue;
    // Also skip if any ancestor is code/pre
    let skip = false;
    let ancestor = parent.parentNode;
    while (ancestor && ancestor !== container) {
      const aTag = ancestor.nodeName.toLowerCase();
      if (aTag === 'code' || aTag === 'pre') { skip = true; break; }
      ancestor = ancestor.parentNode;
    }
    if (skip) continue;

    const text = node.textContent || '';
    if (!text.includes('$')) continue;

    // Match block math $$...$$ and inline math $...$
    const combinedRegex = /\$\$([\s\S]*?)\$\$|(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g;
    let lastIndex = 0;
    let match;
    const fragments = [];
    let hasMatch = false;

    while ((match = combinedRegex.exec(text)) !== null) {
      hasMatch = true;

      // Text before the match
      if (match.index > lastIndex) {
        fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const isBlock = match[1] !== undefined;
      let latex = (isBlock ? match[1] : match[2]).trim();

      // Escape unescaped % to \% so KaTeX treats it as text.
      latex = latex.replace(/(?<!\\)%/g, '\\%');

      try {
        const rendered = katex.renderToString(latex, {
          displayMode: isBlock,
          throwOnError: false,
          strict: false,
          trust: false,
          macros: KATEX_MACROS,
        });
        const span = document.createElement(isBlock ? 'div' : 'span');
        if (isBlock) span.className = 'katex-display';
        span.innerHTML = rendered;
        fragments.push(span);
      } catch (/** @type {any} */ error) {
        const errSpan = document.createElement('span');
        errSpan.className = 'katex-error';
        errSpan.textContent = error.message;
        fragments.push(errSpan);
      }

      lastIndex = match.index + match[0].length;
    }

    if (!hasMatch) continue;

    // Remaining text after last match
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace the text node with fragments
    const frag = document.createDocumentFragment();
    for (const f of fragments) frag.appendChild(f);
    parent.replaceChild(frag, node);
  }
}
