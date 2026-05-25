import { openFile } from '$lib/services/file.js';
import { renderMathInDOM } from '$lib/renderer/katex.js';
import { processMermaidBlocks } from '$lib/renderer/mermaid.js';
import DOMPurify from 'dompurify';

/**
 * Process embed blocks in the container
 * @param {HTMLDivElement} container
 * @param {string} currentFilePath
 * @param {Set<string>} embedChain
 * @returns {Promise<void>}
 */
export async function processEmbeds(container, currentFilePath, embedChain = new Set()) {
  const basePath = currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  const embedElements = container.querySelectorAll('.embed-markdown');

  for (const embedEl of embedElements) {
    const embedPath = embedEl.getAttribute('data-embed-path');
    if (!embedPath) continue;

    // Check for cycle using a per-branch copy
    if (embedChain.has(embedPath)) {
      embedEl.innerHTML = `<span class="embed-error">Circular embed detected: ${embedPath}</span>`;
      continue;
    }

    try {
      const fullPath = `${basePath}/${embedPath}`;

      // Branch-local cycle tracking
      const branchChain = new Set(embedChain);
      branchChain.add(embedPath);

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
      await processEmbeds(/** @type {HTMLDivElement} */ (embedEl), fullPath, branchChain);
    } catch (err) {
      embedEl.innerHTML = `<span class="embed-error">Failed to load: ${embedPath}</span>`;
    }
  }

  // Process image embeds
  const imageEmbeds = container.querySelectorAll('.embed-image img');
  for (const img of imageEmbeds) {
    const src = img.getAttribute('src');
    if (!src) continue;

    // Skip already resolved paths
    if (src.startsWith('asset://')) continue;

    // Handle absolute paths
    const isAbsolute = /^[a-zA-Z]:[/\\]|^\//.test(src);
    const fullPath = isAbsolute
      ? src.replace(/ /g, '%20')
      : `${basePath}/${src}`.replace(/ /g, '%20');

    img.setAttribute('src', `asset://localhost/${fullPath}`);
  }
}
