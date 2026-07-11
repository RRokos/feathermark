<script lang="ts">
  import { onDestroy } from 'svelte';
  import { readDirectory, getParentDirectory, openInEditor, searchFiles, openInNewWindow } from '$lib/services/file.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ navigate: { path: string } }>();

  const SIDEBAR_PATH_KEY = 'mdreader_sidebar_path';

  /** @type {string} */
  export let rootPath = '';

  /** @type {Array<{name: string, path: string, is_dir: boolean}>} */
  let entries: Array<{name: string; path: string; is_dir: boolean}> = [];
  /** @type {Array<{name: string, path: string, is_dir: boolean}>} */
  let filteredEntries: Array<{name: string; path: string; is_dir: boolean}> = [];
  /** @type {string | null} */
  let error: string | null = null;
  /** @type {boolean} */
  let loading = false;
  /** @type {string[]} */
  let pathHistory: string[] = [];
  /** @type {number} */
  let historyIndex = 0;

  // Search state
  let searchQuery: string = '';
  let searchResults: Array<{path: string; file_name: string; line_number: number; line_text: string}> = [];
  let isSearching: boolean = false;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Context menu state
  let contextMenu = { visible: false, x: 0, y: 0, entry: null as {name: string; path: string; is_dir: boolean} | null };

  // Search input ref for external focus
  let searchInput: HTMLInputElement;

  /** Focus the search input (called from parent via bind:this) */
  export function focusSearch() {
    if (searchInput) searchInput.focus();
  }

  $: currentPath = historyIndex >= 0 && pathHistory.length > 0 ? pathHistory[historyIndex] : rootPath;

  /**
   * Normalize path separators for consistent comparison
   */
  function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  // Persist current path
  $: if (currentPath) {
    try { localStorage.setItem(SIDEBAR_PATH_KEY, currentPath); } catch {}
  }

  // Derive filteredEntries WITHOUT a reactive statement that could reset entries
  $: filteredEntries = entries.filter(e =>
    e.is_dir || e.name.endsWith('.md') || e.name.endsWith('.markdown')
  );

  /**
   * @param {string} path
   * @returns {Promise<void>}
   */
  let navigateSeq = 0;

  async function navigateTo(path: string): Promise<void> {
    const seq = ++navigateSeq;
    loading = true;
    error = null;

    try {
      const result = await readDirectory(path);
      if (seq !== navigateSeq) return; // stale navigation, discard
      entries = result;

      if (historyIndex < pathHistory.length - 1) {
        pathHistory = pathHistory.slice(0, historyIndex + 1);
      }
      pathHistory = [...pathHistory, path];
      historyIndex = pathHistory.length - 1;
    } catch (err) {
      if (seq !== navigateSeq) return;
      error = err instanceof Error ? err.message : String(err);
      entries = [];
    } finally {
      if (seq === navigateSeq) loading = false;
    }
  }

  /**
   * @param {MouseEvent} event
   * @param {{ name: string; path: string; is_dir: boolean }} entry
   */
  function handleClick(event: MouseEvent, entry: { name: string; path: string; is_dir: boolean }): void {
    event.stopPropagation();
    if (entry.is_dir) {
      navigateTo(entry.path);
    } else if (entry.name.endsWith('.md')) {
      dispatch('navigate', { path: entry.path });
    }
  }

  function handleContextMenu(event: MouseEvent, entry: { name: string; path: string; is_dir: boolean }): void {
    event.preventDefault();
    event.stopPropagation();
    if (!entry.is_dir && entry.name.endsWith('.md')) {
      contextMenu = { visible: true, x: event.clientX, y: event.clientY, entry };
    }
  }

  function closeContextMenu(): void {
    contextMenu = { visible: false, x: 0, y: 0, entry: null };
  }

  async function contextMenuOpenInEditor(): Promise<void> {
    if (contextMenu.entry) {
      try {
        await openInEditor(contextMenu.entry.path);
      } catch (err) {
        console.error('Failed to open in editor:', err);
      }
    }
    closeContextMenu();
  }

  function contextMenuOpenFile(): void {
    if (contextMenu.entry) {
      dispatch('navigate', { path: contextMenu.entry.path });
    }
    closeContextMenu();
  }

  async function contextMenuOpenInNewWindow(): Promise<void> {
    if (contextMenu.entry) {
      try {
        await openInNewWindow(contextMenu.entry.path);
      } catch (err) {
        console.error('Failed to open in new window:', err);
      }
    }
    closeContextMenu();
  }

  function goUp(): void {
    if (currentPath && normalizePath(currentPath) !== normalizePath(rootPath)) {
      const parent = getParentDirectory(currentPath);
      const normalParent = normalizePath(parent);
      const normalRoot = normalizePath(rootPath);
      if (parent && (normalParent === normalRoot || normalParent.startsWith(normalRoot + '/'))) {
        navigateTo(parent);
      }
    }
  }

  function goBack(): void {
    if (historyIndex > 0) {
      historyIndex--;
      const target = pathHistory[historyIndex];
      if (target) {
        const seq = ++navigateSeq;
        loading = true;
        error = null;
        readDirectory(target).then((result) => {
          if (seq !== navigateSeq) return;
          entries = result;
          loading = false;
        }).catch((err) => {
          if (seq !== navigateSeq) return;
          error = err instanceof Error ? err.message : String(err);
          entries = [];
          loading = false;
        });
      }
    }
  }

  function goForward(): void {
    if (historyIndex < pathHistory.length - 1) {
      historyIndex++;
      const target = pathHistory[historyIndex];
      if (target) {
        const seq = ++navigateSeq;
        loading = true;
        error = null;
        readDirectory(target).then((result) => {
          if (seq !== navigateSeq) return;
          entries = result;
          loading = false;
        }).catch((err) => {
          if (seq !== navigateSeq) return;
          error = err instanceof Error ? err.message : String(err);
          entries = [];
          loading = false;
        });
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async function loadCurrentDirectory(): Promise<void> {
    if (currentPath) {
      loading = true;
      error = null;
      try {
        entries = await readDirectory(currentPath);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        entries = [];
      } finally {
        loading = false;
      }
    }
  }

  function handleSearchInput(): void {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (!searchQuery.trim()) {
      searchResults = [];
      isSearching = false;
      return;
    }
    searchDebounceTimer = setTimeout(async () => {
      if (!searchQuery.trim() || !rootPath) return;
      isSearching = true;
      try {
        searchResults = await searchFiles(rootPath, searchQuery.trim());
      } catch (err) {
        console.error('Search error:', err);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    }, 300);
  }

  function clearSearch(): void {
    searchQuery = '';
    searchResults = [];
    isSearching = false;
  }

  function handleSearchResultClick(result: {path: string; file_name: string; line_number: number; line_text: string}): void {
    dispatch('navigate', { path: result.path });
  }

  let _lastRootPath = '';

  // @ts-ignore
  $: if (rootPath && rootPath !== _lastRootPath) {
    _lastRootPath = rootPath;
    localStorage.removeItem(SIDEBAR_PATH_KEY);
    pathHistory = [rootPath];
    historyIndex = 0;
    clearSearch();
    // Inline async load to avoid reactive re-trigger
    loading = true;
    error = null;
    entries = [];
    readDirectory(rootPath).then((result) => {
      entries = result;
      loading = false;
    }).catch((err) => {
      console.error('[Sidebar] readDirectory error:', err);
      error = err instanceof Error ? err.message : String(err);
      entries = [];
      loading = false;
    });
  }

  // Clean up search debounce timer on component destroy
  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<svelte:window on:click={closeContextMenu} />

<div class="sidebar">
  <div class="toolbar">
    <button on:click={goUp} disabled={!currentPath || normalizePath(currentPath) === normalizePath(rootPath)} title="Go up">
      ↑
    </button>
    <button on:click={goBack} disabled={historyIndex <= 0} title="Go back">
      ←
    </button>
    <button on:click={goForward} disabled={historyIndex >= pathHistory.length - 1} title="Go forward">
      →
    </button>
    <span class="current-path" title={currentPath}>
      {currentPath?.replace(/\\/g, '/').split('/').pop() || 'Select folder'}
    </span>
  </div>

  <div class="search-bar">
    <input
      type="search"
      placeholder="搜索..."
      bind:value={searchQuery}
      bind:this={searchInput}
      on:input={handleSearchInput}
    />
    {#if searchQuery}
      <button class="search-clear" on:click={clearSearch} title="Clear search">✕</button>
    {/if}
  </div>

  <div class="tree">
    {#if searchQuery.trim()}
      <!-- Search results mode -->
      {#if isSearching}
        <div class="loading">Searching...</div>
      {:else if searchResults.length === 0}
        <div class="empty">No results</div>
      {:else}
        <div class="search-count">{searchResults.length} result{searchResults.length > 1 ? 's' : ''}</div>
        {#each searchResults as result}
          <button
            class="tree-item search-result"
            on:click={() => handleSearchResultClick(result)}
            on:contextmenu={(e) => handleContextMenu(e, { name: result.file_name, path: result.path, is_dir: false })}
          >
            <div class="result-file">📄 {result.file_name}<span class="result-line">:{result.line_number}</span></div>
            <div class="result-text">{result.line_text.length > 80 ? result.line_text.substring(0, 80) + '...' : result.line_text}</div>
          </button>
        {/each}
      {/if}
    {:else}
      <!-- Normal directory tree mode -->
      {#if loading}
        <div class="loading">Loading...</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else if filteredEntries.length === 0}
        <div class="empty">No markdown files</div>
      {:else}
        {#each filteredEntries as entry}
          <button
            class="tree-item"
            class:directory={entry.is_dir}
            class:file={!entry.is_dir}
            on:click={(e) => handleClick(e, entry)}
            on:contextmenu={(e) => handleContextMenu(e, entry)}
          >
            <span class="icon">{entry.is_dir ? '📁' : '📄'}</span>
            <span class="name">{entry.name}</span>
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<!-- Context menu -->
{#if contextMenu.visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    on:click|stopPropagation
    on:keydown|stopPropagation
  >
    <button class="context-menu-item" on:click={contextMenuOpenFile}>
      📄 Open
    </button>
    <button class="context-menu-item" on:click={contextMenuOpenInNewWindow}>
      🪟 Open in new window
    </button>
    <button class="context-menu-item" on:click={contextMenuOpenInEditor}>
      ✏️ Open in editor
    </button>
  </div>
{/if}

<style>
  .sidebar {
    width: 250px;
    min-width: 200px;
    background: #f6f6f6;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(.dark) .sidebar {
    background: #252526;
    border-color: #333;
    color: #e0e0e0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid #e0e0e0;
    background: #f0f0f0;
  }

  :global(.dark) .toolbar {
    background: #1e1e1e;
    border-color: #333;
  }

  .toolbar button {
    background: none;
    border: 1px solid #ccc;
    color: inherit;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 14px;
  }

  :global(.dark) .sidebar .toolbar button {
    color: #f5f5f5;
    border-color: #555;
  }

  .toolbar button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.dark) .sidebar .toolbar button:disabled {
    color: #8a8a8a;
  }

  .toolbar button:hover:not(:disabled) {
    background: #e0e0e0;
  }

  :global(.dark) .toolbar button:hover:not(:disabled) {
    background: #333;
  }

  .current-path {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    color: #666;
  }

  :global(.dark) .current-path {
    color: #888;
  }

  /* Search bar */
  .search-bar {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px solid #e0e0e0;
    gap: 4px;
  }

  :global(.dark) .search-bar {
    border-color: #333;
  }

  .search-bar input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 12px;
    background: #fff;
    color: #333;
    outline: none;
  }

  .search-bar input:focus {
    border-color: var(--accent, #646cff);
  }

  :global(.dark) .search-bar input {
    background: #1e1e1e;
    border-color: #555;
    color: #e0e0e0;
  }

  :global(.dark) .search-bar input:focus {
    border-color: var(--accent, #646cff);
  }

  .search-clear {
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 2px;
  }

  .search-clear:hover {
    color: #cc0000;
    background: rgba(0,0,0,0.05);
  }

  .search-count {
    padding: 4px 8px;
    font-size: 11px;
    color: #888;
    border-bottom: 1px solid #e0e0e0;
  }

  :global(.dark) .search-count {
    border-color: #333;
  }

  .tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    color: inherit;
    font-size: 13px;
  }

  .tree-item:hover {
    background: rgba(100, 108, 255, 0.1);
  }

  .tree-item.search-result {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px 8px;
  }

  .result-file {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent, #646cff);
  }

  .result-line {
    font-weight: 400;
    color: #888;
  }

  .result-text {
    font-size: 11px;
    color: #666;
    line-height: 1.4;
    word-break: break-all;
  }

  :global(.dark) .result-text {
    color: #999;
  }

  .icon {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading, .error, .empty {
    padding: 16px;
    text-align: center;
    color: #888;
    font-size: 13px;
  }

  .error {
    color: #cc0000;
  }

  /* Context menu */
  :global(.context-menu) {
    position: fixed;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 160px;
    padding: 4px 0;
  }

  :global(.dark .context-menu) {
    background: #2d2d2d;
    border-color: #444;
  }

  .context-menu-item {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: inherit;
  }

  .context-menu-item:hover {
    background: rgba(100, 108, 255, 0.1);
  }
</style>
