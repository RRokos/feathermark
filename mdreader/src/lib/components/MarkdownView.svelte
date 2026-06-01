<script lang="ts">
  import { afterUpdate, tick, createEventDispatcher } from 'svelte';
  import { renderMarkdown, parseFrontmatter } from '$lib/parser/markdown.js';
  import { renderMathInDOM } from '$lib/renderer/katex.js';
  import { processMermaidBlocks } from '$lib/renderer/mermaid.js';
  import { processEmbeds } from '$lib/renderer/embed.js';
  import DOMPurify from 'dompurify';

  export let content: string = '';
  export let filePath: string = '';
  export let isDark: boolean = false;

  const dispatch = createEventDispatcher<{ navigate: { path: string; anchor: string | null } }>();

  let container: HTMLDivElement | null = null;
  let renderedHtml: string = '';
  let parsedContent: string = '';
  let mermaidProcessed: boolean = false;
  let lastAppliedHtml: string = '';

  // Configure DOMPurify to allow our custom elements and attributes
  const purifyConfig = {
    ADD_TAGS: ['span', 'div', 'sup', 'ol', 'li', 'hr', 'svg', 'path', 'g', 'rect', 'text', 'line', 'circle', 'polygon', 'polyline', 'marker', 'defs', 'clipPath', 'foreignObject', 'tspan'],
    ADD_ATTR: ['class', 'data-embed-path', 'data-footnote-id', 'id', 'style', 'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points', 'marker-end', 'marker-start', 'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'clip-path', 'dx', 'dy'],
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false
  };

  let frontmatterHtml: string = '';

  $: {
    const result = parseFrontmatter(content);
    parsedContent = result.body;

    // Build frontmatter display
    if (result.frontmatter && Object.keys(result.frontmatter).length > 0) {
      const rows = Object.entries(result.frontmatter)
        .map(([k, v]) => `<tr><td class="fm-key">${DOMPurify.sanitize(k)}</td><td class="fm-val">${DOMPurify.sanitize(String(v))}</td></tr>`)
        .join('');
      frontmatterHtml = `<div class="frontmatter"><table>${rows}</table></div>`;
    } else {
      frontmatterHtml = '';
    }

    const rawHtml = renderMarkdown(parsedContent);
    renderedHtml = frontmatterHtml + DOMPurify.sanitize(rawHtml, purifyConfig);
    mermaidProcessed = false;
  }

  const MERMAID_FIT_KEY = 'mdreader_mermaid_fit';

  afterUpdate(async (): Promise<void> => {
    if (container && renderedHtml && renderedHtml !== lastAppliedHtml) {
      lastAppliedHtml = renderedHtml;
      container.innerHTML = renderedHtml;

      // Process math using DOM-based approach (safe against HTML attribute corruption)
      renderMathInDOM(container);

      if (!mermaidProcessed) {
        mermaidProcessed = true;
        await tick();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (container) {
          await processMermaidBlocks(container, isDark);

          // Apply sizing based on setting
          const fitWidth = localStorage.getItem(MERMAID_FIT_KEY) === 'true';
          container.querySelectorAll('.mermaid-diagram').forEach((el) => {
            const svg = el.querySelector('svg');
            if (!svg) return;

            if (fitWidth) {
              svg.style.width = '100%';
              svg.style.height = 'auto';
              svg.style.maxWidth = '100%';
            } else {
              // Obsidian style: original size, page scrolls horizontally
              const origWidth = svg.getAttribute('data-original-width');
              if (origWidth) {
                svg.style.width = origWidth + 'px';
                svg.style.height = 'auto';
                svg.style.maxWidth = 'none';
              }
            }
          });
        }
      }

      // Process embeds
      await processEmbeds(container, filePath);
    }
  });

  function getBasePath(): string {
    if (!filePath) return '';
    const parts: string[] = filePath.replace(/\\/g, '/').split('/');
    parts.pop();
    return parts.join('/');
  }

  function resolveImagePath(src: string): string {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('asset://')) {
      return src;
    }
    const base: string = getBasePath();
    return `asset://localhost/${base}/${src}`;
  }

  function resolveWikiLink(href: string): string {
    if (!href) return '#';
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }
    if (href.startsWith('/vault/')) {
      return href;
    }
    return `#${href}`;
  }

  function handleClick(event: MouseEvent): void {
    const target: HTMLElement | null = (event.target as HTMLElement).closest('a');
    if (!target) return;

    const href: string | null = target.getAttribute('href');
    if (!href) return;

    if (href.startsWith('/vault/')) {
      event.preventDefault();

      let pagePart: string = decodeURIComponent(href.replace('/vault/', ''));
      let anchor: string = '';

      if (pagePart.includes('#')) {
        const parts: string[] = pagePart.split('#');
        pagePart = parts[0];
        anchor = parts.slice(1).join('#');
      }

      const base: string = getBasePath();
      const fullPath: string = `${base}/${pagePart}.md`;

      dispatch('navigate', { path: fullPath, anchor: anchor || null });
    } else if (href.startsWith('#')) {
      event.preventDefault();
      const heading = container?.querySelector(href);
      if (heading instanceof Element) {
        heading.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      // Open external links in system browser
      event.preventDefault();
      import('@tauri-apps/plugin-opener').then(({ openUrl }) => {
        openUrl(href);
      }).catch(() => {
        // Fallback: try window.open
        window.open(href, '_blank');
      });
    } else {
      const target = event.target as HTMLElement;
      if (target.closest('.footnote-ref')) {
        event.preventDefault();
        const footnoteId = (target.closest('.footnote-ref') as HTMLElement)?.dataset.footnoteId;
        if (footnoteId) {
          const footnoteDef = container?.querySelector(`#footnote-${footnoteId}`);
          if (footnoteDef) {
            footnoteDef.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="markdown-view" bind:this={container} on:click={handleClick}></div>

<style>
  .markdown-view {
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.7;
  }

  :global(.markdown-view .frontmatter) {
    margin-bottom: 1.5rem;
    padding: 12px 16px;
    background: #f6f8fa;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    font-size: 0.85rem;
  }

  :global(.dark .markdown-view .frontmatter) {
    background: #252526;
    border-color: #333;
  }

  :global(.markdown-view .frontmatter table) {
    width: 100%;
    border: none;
    margin: 0;
  }

  :global(.markdown-view .frontmatter td) {
    border: none;
    padding: 2px 8px 2px 0;
    vertical-align: top;
  }

  :global(.markdown-view .frontmatter .fm-key) {
    font-weight: 600;
    color: #646cff;
    white-space: nowrap;
    width: 1%;
  }

  :global(.markdown-view .frontmatter .fm-val) {
    color: #555;
  }

  :global(.dark .markdown-view .frontmatter .fm-val) {
    color: #aaa;
  }

  :global(.markdown-view h1) {
    font-size: 2rem;
    margin: 1.5rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  :global(.dark .markdown-view h1) {
    border-bottom-color: #333;
  }

  :global(.markdown-view h2) {
    font-size: 1.5rem;
    margin: 1.25rem 0 0.75rem;
  }

  :global(.markdown-view h3) {
    font-size: 1.25rem;
    margin: 1rem 0 0.5rem;
  }

  :global(.markdown-view h4, .markdown-view h5, .markdown-view h6) {
    font-size: 1rem;
    margin: 0.75rem 0 0.5rem;
  }

  :global(.markdown-view p) {
    margin: 0.75rem 0;
  }

  :global(.markdown-view a) {
    color: #646cff;
    text-decoration: none;
  }

  :global(.markdown-view a:hover) {
    text-decoration: underline;
  }

  :global(.markdown-view code) {
    background: #f0f0f0;
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
  }

  :global(.dark .markdown-view code) {
    background: #333;
  }

  :global(.markdown-view pre) {
    background: #f6f8fa;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
  }

  :global(.dark .markdown-view pre) {
    background: #1e1e1e;
  }

  :global(.markdown-view pre code) {
    background: none;
    padding: 0;
  }

  :global(.markdown-view blockquote) {
    border-left: 4px solid #646cff;
    margin: 1rem 0;
    padding: 0.5rem 1rem;
    background: #f9f9f9;
  }

  :global(.dark .markdown-view blockquote) {
    background: #252526;
  }

  :global(.markdown-view ul, .markdown-view ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  :global(.markdown-view li) {
    margin: 0.25rem 0;
  }

  :global(.markdown-view table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }

  :global(.markdown-view th, .markdown-view td) {
    border: 1px solid #e0e0e0;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  :global(.dark .markdown-view th, .dark .markdown-view td) {
    border-color: #333;
  }

  :global(.markdown-view th) {
    background: #f6f8fa;
    font-weight: 600;
  }

  :global(.dark .markdown-view th) {
    background: #252526;
  }

  :global(.markdown-view hr) {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 1.5rem 0;
  }

  :global(.dark .markdown-view hr) {
    border-top-color: #333;
  }

  :global(.markdown-view img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5rem 0;
  }

  :global(.markdown-view .katex-display) {
    overflow-x: auto;
    padding: 0.5rem 0;
  }

  :global(.markdown-view .katex-error) {
    color: #cc0000;
    font-size: 0.9em;
  }

  :global(.markdown-view .mermaid-diagram) {
    margin: 1rem 0;
    text-align: center;
  }

  :global(.markdown-view .mermaid-diagram svg) {
    height: auto;
    display: block;
    margin: 0 auto;
  }

  :global(.markdown-view .mermaid-error) {
    background: #fff0f0;
    color: #cc0000;
    padding: 1rem;
    border-radius: 4px;
    margin: 0.5rem 0;
  }

  :global(.dark .markdown-view .mermaid-error) {
    background: #2a1a1a;
  }

  :global(.markdown-view input[type="checkbox"]) {
    margin-right: 0.5rem;
  }

  :global(.markdown-view a.internal-link) {
    color: #646cff;
    cursor: pointer;
  }

  :global(.markdown-view blockquote.callout) {
    border-left-color: #646cff;
    background: #f0f4ff;
  }

  :global(.dark .markdown-view blockquote.callout) {
    background: #1a1f2a;
  }

  :global(.markdown-view .callout) {
    border-left: 4px solid #646cff;
    background: #f0f4ff;
    margin: 1rem 0;
    padding: 0;
    border-radius: 4px;
    overflow: hidden;
  }

  :global(.dark .markdown-view .callout) {
    background: #1a1f2a;
  }

  :global(.markdown-view .callout-title) {
    padding: 8px 12px;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.05);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  :global(.dark .markdown-view .callout-title) {
    background: rgba(255, 255, 255, 0.05);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  :global(.markdown-view .callout-content) {
    padding: 12px 16px;
  }

  :global(.markdown-view .callout-content p) {
    margin: 0.5rem 0;
  }

  :global(.markdown-view .callout-content p:first-child) {
    margin-top: 0;
  }

  :global(.markdown-view .callout-content p:last-child) {
    margin-bottom: 0;
  }

  /* Callout type colors */
  :global(.markdown-view .callout-note) {
    border-left-color: #646cff;
  }

  :global(.markdown-view .callout-note .callout-title) {
    background: rgba(100, 108, 255, 0.1);
  }

  :global(.markdown-view .callout-warning) {
    border-left-color: #f59e0b;
  }

  :global(.markdown-view .callout-warning .callout-title) {
    background: rgba(245, 158, 11, 0.1);
    color: #b45309;
  }

  :global(.dark .markdown-view .callout-warning .callout-title) {
    color: #f59e0b;
  }

  :global(.markdown-view .callout-tip) {
    border-left-color: #10b981;
  }

  :global(.markdown-view .callout-tip .callout-title) {
    background: rgba(16, 185, 129, 0.1);
    color: #047857;
  }

  :global(.dark .markdown-view .callout-tip .callout-title) {
    color: #10b981;
  }

  :global(.markdown-view .callout-example) {
    border-left-color: #8b5cf6;
  }

  :global(.markdown-view .callout-example .callout-title) {
    background: rgba(139, 92, 246, 0.1);
    color: #6d28d9;
  }

  :global(.dark .markdown-view .callout-example .callout-title) {
    color: #8b5cf6;
  }

  :global(.markdown-view .callout-quote) {
    border-left-color: #64748b;
  }

  :global(.markdown-view .callout-quote .callout-title) {
    background: rgba(100, 116, 139, 0.1);
    color: #475569;
  }

  :global(.dark .markdown-view .callout-quote .callout-title) {
    color: #94a3b8;
  }

  /* Callout: abstract/summary/tldr */
  :global(.markdown-view .callout-abstract),
  :global(.markdown-view .callout-summary),
  :global(.markdown-view .callout-tldr) { border-left-color: #06b6d4; }
  :global(.markdown-view .callout-abstract .callout-title),
  :global(.markdown-view .callout-summary .callout-title),
  :global(.markdown-view .callout-tldr .callout-title) { background: rgba(6, 182, 212, 0.1); color: #0891b2; }
  :global(.dark .markdown-view .callout-abstract .callout-title),
  :global(.dark .markdown-view .callout-summary .callout-title),
  :global(.dark .markdown-view .callout-tldr .callout-title) { color: #06b6d4; }
  :global(.dark .markdown-view .callout-abstract),
  :global(.dark .markdown-view .callout-summary),
  :global(.dark .markdown-view .callout-tldr) { background: #1a2226; }

  /* Callout: formula/math/info */
  :global(.markdown-view .callout-formula),
  :global(.markdown-view .callout-math) { border-left-color: #8b5cf6; }
  :global(.markdown-view .callout-formula .callout-title),
  :global(.markdown-view .callout-math .callout-title) { background: rgba(139, 92, 246, 0.1); color: #6d28d9; }
  :global(.dark .markdown-view .callout-formula .callout-title),
  :global(.dark .markdown-view .callout-math .callout-title) { color: #8b5cf6; }
  :global(.dark .markdown-view .callout-formula),
  :global(.dark .markdown-view .callout-math) { background: #1f1a2e; }

  :global(.markdown-view .callout-info) { border-left-color: #646cff; }
  :global(.markdown-view .callout-info .callout-title) { background: rgba(100, 108, 255, 0.1); }

  /* Nested callouts */
  :global(.markdown-view .callout .callout) {
    margin: 0.5rem 0;
  }

  /* Footnotes */
  :global(.markdown-view .footnotes) {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
    font-size: 0.9rem;
    color: #666;
  }

  :global(.dark .markdown-view .footnotes) {
    border-top-color: #333;
    color: #888;
  }

  :global(.markdown-view .footnotes hr) {
    margin-bottom: 1rem;
  }

  :global(.markdown-view .footnotes ol) {
    padding-left: 1.5rem;
  }

  :global(.markdown-view .footnotes li) {
    margin: 0.5rem 0;
  }

  :global(.markdown-view .footnote-ref) {
    color: #646cff;
    cursor: pointer;
    font-size: 0.75rem;
    margin-left: 2px;
  }

  :global(.markdown-view .footnote-ref:hover) {
    text-decoration: underline;
  }

  /* Tags */
  :global(.markdown-view .tag) {
    color: #646cff;
    background: rgba(100, 108, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: 500;
  }

  :global(.dark .markdown-view .tag) {
    background: rgba(100, 108, 255, 0.2);
  }

  /* Embeds */
  :global(.markdown-view .embed-image) {
    margin: 1rem 0;
  }

  :global(.markdown-view .embed-image img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  :global(.markdown-view .embed-markdown) {
    margin: 1rem 0;
    padding: 1rem;
    background: #f6f8fa;
    border-radius: 6px;
    border-left: 3px solid #646cff;
  }

  :global(.dark .markdown-view .embed-markdown) {
    background: #252526;
  }

  :global(.markdown-view .embed-content) {
    max-width: 100%;
  }

  :global(.markdown-view .embed-loading) {
    color: #888;
    font-style: italic;
  }

  :global(.markdown-view .embed-error) {
    color: #cc0000;
    padding: 0.5rem;
    background: #fff0f0;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  :global(.dark .markdown-view .embed-error) {
    background: #2a1a1a;
  }
</style>