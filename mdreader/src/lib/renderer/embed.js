import { openFile } from '$lib/services/file.js';
import { renderMathInDOM } from '$lib/renderer/katex.js';
import { processMermaidBlocks } from '$lib/renderer/mermaid.js';
import DOMPurify from 'dompurify';

/** Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MAX_EMBED_DEPTH = 10;

/**
 * Process embed blocks in the container
 * @param {HTMLDivElement} container
 * @param {string} currentFilePath
 * @param {Set<string>} embedChain
 * @param {number} depth
 * @returns {Promise<void>}
 */
export async function processEmbeds(container, currentFilePath, embedChain = new Set(), depth = 0) {
  if (depth > MAX_EMBED_DEPTH) return;

  const pathParts = currentFilePath.replace(/\\/g, '/').split('/');
  pathParts.pop();
  const basePath = pathParts.join('/') || '.';
  const embedElements = container.querySelectorAll('.embed-markdown');

  for (const embedEl of embedElements) {
    const embedPath = embedEl.getAttribute('data-embed-path');
    if (!embedPath) continue;

    // Normalize path for cycle detection
    const normalizedPath = embedPath.replace(/\\/g, '/');
    if (embedChain.has(normalizedPath)) {
      embedEl.innerHTML = `<span class="embed-error">Circular embed detected: ${escapeHtml(embedPath)}</span>`;
      continue;
    }

    try {
      const fullPath = `${basePath}/${embedPath}`;

      // Branch-local cycle tracking
      const branchChain = new Set(embedChain);
      branchChain.add(normalizedPath);

      const result = await openFile(fullPath);

      // Render the embedded content (parseFrontmatter handles frontmatter removal)
      const { renderMarkdown, parseFrontmatter } = await import('$lib/parser/markdown.js');
      const parsed = parseFrontmatter(result.content);
      const html = DOMPurify.sanitize(renderMarkdown(parsed.body), {
        ADD_ATTR: ['class', 'data-embed-path', 'data-footnote-id', 'id'],
        ALLOW_DATA_ATTR: true
      });

      embedEl.innerHTML = `<div class="embed-content">${html}</div>`;

      // Post-process: KaTeX and Mermaid inside embeds
      renderMathInDOM(/** @type {HTMLElement} */ (embedEl));
      await processMermaidBlocks(/** @type {HTMLElement} */ (embedEl));

      // Recursively process nested embeds
      await processEmbeds(/** @type {HTMLDivElement} */ (embedEl), fullPath, branchChain, depth + 1);
    } catch (err) {
      embedEl.innerHTML = `<span class="embed-error">Failed to load: ${escapeHtml(embedPath)}</span>`;
    }
  }

  // Process image embeds
  const imageEmbeds = container.querySelectorAll('.embed-image img');
  for (const img of imageEmbeds) {
    const src = img.getAttribute('src');
    if (!src) continue;

    // Skip already resolved paths and remote URLs
    if (src.startsWith('asset://') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;

    // Handle absolute paths
    const isAbsolute = /^[a-zA-Z]:[/\\]|^\//.test(src);
    const rawPath = isAbsolute ? src : `${basePath}/${src}`;
    // Encode special characters for asset:// protocol
    const fullPath = rawPath.split('/').map(encodeURIComponent).join('/');

    img.setAttribute('src', `asset://localhost/${fullPath}`);
  }
}
