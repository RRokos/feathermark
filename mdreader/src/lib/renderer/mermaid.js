import mermaid from 'mermaid';

let initialized = false;
let currentTheme = 'default';

/**
 * @param {boolean} isDark
 * @returns {Promise<void>}
 */
async function initializeMermaid(isDark = false) {
  const theme = isDark ? 'dark' : 'default';

  if (initialized && currentTheme === theme) return;

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily: 'Arial, sans-serif'
    });
    initialized = true;
    currentTheme = theme;
  } catch (e) {
    console.error('Mermaid init error:', e);
  }
}

let mermaidIdCounter = 0;

/**
 * @param {Element} container
 * @param {boolean} isDark
 * @returns {Promise<void>}
 */
export async function processMermaidBlocks(container, isDark = false) {
  await initializeMermaid(isDark);

  // Find mermaid blocks: both explicitly tagged and heuristic detection
  const mermaidBlocks = container.querySelectorAll('pre.mermaid-block, pre.code-block');

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const preEl = mermaidBlocks[i];
    const codeEl = preEl.querySelector('code');
    if (!codeEl || !codeEl.textContent) continue;

    const code = codeEl.textContent.trim();
    const isExplicitMermaid = preEl.classList.contains('mermaid-block');
    // Only apply heuristic detection on code blocks WITHOUT an explicit language specifier
    const hasLangSpecifier = codeEl.classList.contains('hljs') ||
      Array.from(codeEl.classList).some(c => c.startsWith('language-'));

    if (isExplicitMermaid || (!hasLangSpecifier && (
        code.startsWith('flowchart') || code.startsWith('sequenceDiagram') ||
        code.startsWith('classDiagram') || code.startsWith('stateDiagram') ||
        code.startsWith('pie') || code.startsWith('erDiagram') ||
        code.startsWith('graph') || code.startsWith('mindmap') ||
        code.startsWith('gantt') || code.startsWith('journey') ||
        code.startsWith('gitGraph') || code.startsWith('timeline') ||
        code.startsWith('xychart') || code.startsWith('sankey') ||
        code.startsWith('block') || code.startsWith('packet')))) {

      try {
        const id = `mermaid-${++mermaidIdCounter}`;
        const { svg } = await mermaid.render(id, code);

        const div = document.createElement('div');
        div.className = 'mermaid-diagram';
        div.innerHTML = svg;

        // Mermaid 11 outputs SVG with width="100%" by default.
        // Extract the actual width from viewBox so we can restore original size when needed.
        const svgEl = div.querySelector('svg');
        if (svgEl) {
          const viewBox = svgEl.getAttribute('viewBox');
          if (viewBox) {
            const parts = viewBox.split(/[\s,]+/);
            const vbWidth = parseFloat(parts[2]);
            if (vbWidth && !isNaN(vbWidth)) {
              // Store original width as data attribute
              svgEl.setAttribute('data-original-width', String(Math.ceil(vbWidth)));
            }
          }
          // Remove Mermaid's default width="100%" — let our CSS/JS control sizing
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.removeAttribute('style');
        }

        preEl.replaceWith(div);
      } catch (/** @type {any} */ error) {
        const errDiv = document.createElement('pre');
        errDiv.className = 'mermaid-error';
        errDiv.textContent = `Mermaid Error: ${error.message}`;
        preEl.replaceWith(errDiv);
      }
    }
  }
}

/**
 * @returns {void}
 */
export function resetMermaid() {
  initialized = false;
}

export default mermaid;
