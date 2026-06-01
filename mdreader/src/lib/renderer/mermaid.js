import mermaid from 'mermaid';

let initialized = false;
let currentTheme = 'default';
/** @type {Promise<void>|null} */
let initPromise = null;

/**
 * @param {boolean} isDark
 * @returns {Promise<void>}
 */
async function initializeMermaid(isDark = false) {
  const theme = isDark ? 'dark' : 'default';

  if (initialized && currentTheme === theme) return;

  // Guard against concurrent initialization
  if (initPromise) return initPromise;

  initPromise = (async () => {
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
      // Allow retry on next call
      initPromise = null;
    }
  })();

  return initPromise;
}

let mermaidIdCounter = 0;

/**
 * @param {Element} container
 * @param {boolean} isDark
 * @returns {Promise<void>}
 */
export async function processMermaidBlocks(container, isDark = false) {
  await initializeMermaid(isDark);

  // Find mermaid blocks: only explicitly tagged (```mermaid code blocks)
  const mermaidBlocks = container.querySelectorAll('pre.mermaid-block');

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const preEl = mermaidBlocks[i];
    const codeEl = preEl.querySelector('code');
    if (!codeEl || !codeEl.textContent) continue;

    const code = codeEl.textContent.trim();

    {

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
  initPromise = null;
}

export default mermaid;
