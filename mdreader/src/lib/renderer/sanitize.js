import DOMPurify from 'dompurify';

let hooksInstalled = false;

const SAFE_STYLE_URL = /^url\(\s*(['"]?)#[-_a-zA-Z0-9:.]+\1\s*\)$/i;
const UNSAFE_STYLE = /@import|expression\s*\(|behavior\s*:|-moz-binding|javascript:/i;
const STYLE_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

/**
 * Keep inline SVG styles useful for local drawings, while blocking style-based
 * remote loads and legacy browser execution paths.
 * @param {string} styleText
 * @returns {string}
 */
function sanitizeStyleText(styleText) {
  if (!styleText) return '';
  if (UNSAFE_STYLE.test(styleText)) return '';

  return styleText.replace(STYLE_URL, (match) => {
    return SAFE_STYLE_URL.test(match) ? match : '';
  });
}

/**
 * @param {Node} node
 * @returns {boolean}
 */
function hasSvgAncestor(node) {
  let current = node.parentNode;
  while (current) {
    if (current.nodeName?.toLowerCase() === 'svg') return true;
    current = current.parentNode;
  }
  return false;
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
      data.attrValue = sanitizeStyleText(data.attrValue);
    }
  });

  DOMPurify.addHook('afterSanitizeElements', (node) => {
    if (node.nodeName?.toLowerCase() === 'style') {
      if (!hasSvgAncestor(node)) {
        node.parentNode?.removeChild(node);
        return;
      }
      node.textContent = sanitizeStyleText(node.textContent || '');
    }
  });
}

export const markdownPurifyConfig = {
  ADD_TAGS: [
    'span', 'div', 'sup', 'ol', 'li', 'hr',
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline',
    'polygon', 'text', 'tspan', 'textPath', 'defs', 'marker', 'clipPath',
    'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop', 'filter',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
    'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
    'feDropShadow', 'feFlood', 'feGaussianBlur', 'feImage', 'feMerge',
    'feMergeNode', 'feMorphology', 'feOffset', 'feSpecularLighting',
    'feTile', 'feTurbulence', 'foreignObject', 'style', 'symbol', 'use',
    'image', 'title', 'desc'
  ],
  ADD_ATTR: [
    'class', 'data-embed-path', 'data-footnote-id', 'data-original-width',
    'id', 'style', 'viewBox', 'xmlns', 'xmlns:xlink', 'preserveAspectRatio',
    'd', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity',
    'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'transform', 'opacity', 'x',
    'x1', 'x2', 'y', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'cx', 'cy',
    'r', 'fx', 'fy', 'points', 'marker-end', 'marker-start', 'marker-mid',
    'text-anchor', 'dominant-baseline', 'alignment-baseline',
    'baseline-shift', 'font-size', 'font-family', 'font-weight', 'font-style',
    'letter-spacing', 'clip-path', 'clip-rule', 'mask', 'filter', 'offset',
    'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
    'patternUnits', 'patternContentUnits', 'href', 'xlink:href', 'dx', 'dy',
    'role', 'aria-label', 'aria-hidden'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
  FORBID_ATTR: [
    'onabort', 'onerror', 'onload', 'onclick', 'onmouseenter',
    'onmouseleave', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'
  ]
};

/**
 * @param {string} html
 * @param {Record<string, any>} [overrides]
 * @returns {string}
 */
export function sanitizeMarkdownHtml(html, overrides = {}) {
  installHooks();
  return DOMPurify.sanitize(html, {
    ...markdownPurifyConfig,
    ...overrides
  });
}
