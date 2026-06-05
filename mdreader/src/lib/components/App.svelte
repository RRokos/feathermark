<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { open } from '@tauri-apps/plugin-dialog';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MarkdownView from '$lib/components/MarkdownView.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import {
    documentState, theme, recentFiles, recentVaults, uiScale,
    UI_SCALE_STEP, normalizeUiScale,
    setDocument, setLoading, setError, clearDocument, addToRecentFiles,
    removeRecentFile,
    addToRecentVaults, clearAllRecents
  } from '$lib/stores/document.js';
  import {
    tabsEnabled, activeTab,
    addTab, clearTabs
  } from '$lib/stores/tabs.js';
  import { openFile, watchFile, openInEditor, listMarkdownFiles } from '$lib/services/file.js';

  let errorMessage: string = '';
  let sidebarRoot: string = '';
  let fileModifiedExternally: boolean = false;
  let sidebarRef: any = null;
  let showSettings: boolean = false;
  let renderKey: number = 0;
  let recentTab: 'vaults' | 'files' = 'vaults';
  let appliedUiScale: number | null = null;
  let lastZoomWheelAt: number = 0;

  function handleSettingsChanged(): void {
    renderKey++;
  }

  // Reactive: get display content from active tab or documentState
  $: displayContent = $tabsEnabled && $activeTab
    ? $activeTab.content
    : $documentState.content;
  $: displayFilePath = $tabsEnabled && $activeTab
    ? $activeTab.filePath
    : ($documentState.filePath || '');
  $: displayStatus = $tabsEnabled
    ? ($activeTab ? 'ready' : $documentState.status)
    : $documentState.status;
  $: displayTitle = $tabsEnabled && $activeTab
    ? $activeTab.title
    : ($documentState.title || 'Feathermark');
  $: if (typeof window !== 'undefined') {
    applyUiScale($uiScale);
  }

  async function handleOpenInEditor(): Promise<void> {
    const path = $tabsEnabled && $activeTab ? $activeTab.filePath : $documentState.filePath;
    if (path) {
      try {
        await openInEditor(path);
      } catch (err) {
        console.error('Failed to open in editor:', err);
      }
    }
  }

  let loadFileSeq = 0;

  async function loadFile(filePath: string, anchor: string | null = null): Promise<void> {
    if (!filePath) return;
    const seq = ++loadFileSeq;
    let cleanPath: string = filePath;
    let scrollAnchor: string | null = anchor;

    if (filePath.includes('#')) {
      const parts: string[] = filePath.split('#');
      cleanPath = parts[0];
      scrollAnchor = parts.slice(1).join('#') || null;
    }

    // Backend handles relative path resolution via current_dir()
    let absolutePath: string = cleanPath;

    setLoading(absolutePath);
    errorMessage = '';

    try {
      const result: { content: string; path: string } = await openFile(absolutePath);
      if (seq !== loadFileSeq) return; // stale load, discard

      // Always update documentState so status stays in sync
      setDocument(result.path, result.content);
      if ($tabsEnabled) {
        addTab(result.path, result.content);
      }

      fileModifiedExternally = false;
      if (scrollAnchor) scrollToAnchor(scrollAnchor);

      // Watch file separately — failure should not block display
      watchFile(result.path).catch((watchErr: unknown) => {
        console.warn('Failed to watch file:', watchErr);
      });
    } catch (err: unknown) {
      const errStr = String(err);
      const isNotFound = errStr.includes('not found') || errStr.includes('File not found') || errStr.includes('找不到');

      if (!isNotFound) {
        // Permission / encoding / IO error — show raw message, don't remove from recents
        console.error('Failed to load file:', err);
        errorMessage = errStr;
        setError(absolutePath, errorMessage);
        return;
      }

      // File not found — try vault-wide wikilink resolution
      const rawFileName = cleanPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/, '') || '';
      const fileName = decodeURIComponent(rawFileName);
      const currentFile = $tabsEnabled && $activeTab ? $activeTab.filePath : ($documentState.filePath || '');
      const resolved = resolveWikilink(fileName, currentFile);

      if (resolved && resolved !== absolutePath) {
        try {
          const result2 = await openFile(resolved);
          if (seq !== loadFileSeq) return;

          setDocument(result2.path, result2.content);
          if ($tabsEnabled) {
            addTab(result2.path, result2.content);
          }

          fileModifiedExternally = false;
          removeRecentFile(absolutePath);
          if (scrollAnchor) scrollToAnchor(scrollAnchor);

          watchFile(result2.path).catch((watchErr: unknown) => {
            console.warn('Failed to watch file:', watchErr);
          });
          return;
        } catch (resolveErr) {
          console.warn('Wikilink resolution also failed:', resolveErr);
        }
      }

      // Not found anywhere — remove stale entry
      console.error('File not found, removing from recent:', absolutePath);
      removeRecentFile(absolutePath);
      const displayName = fileName
        ? `${fileName}.md`
        : cleanPath.replace(/\\/g, '/').split('/').pop() || cleanPath;
      errorMessage = `${displayName} 已不存在（可能被移动或删除），已从最近文件中移除`;
      setError(absolutePath, errorMessage);
    }
  }

  function getFolderName(folderPath: string): string {
    const parts = folderPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || folderPath;
  }

  function scrollToAnchor(anchor: string): void {
    setTimeout(() => {
      try {
        const heading: Element | null = document.getElementById(anchor) ||
          document.querySelector(`[id="${CSS.escape(anchor)}"]`);
        if (heading) {
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch {
        // Invalid anchor characters — silently ignore
      }
    }, 150);
  }

  function toggleTheme(): void {
    theme.update((current: string): string => current === 'light' ? 'dark' : 'light');
  }

  function applyUiScale(scale: number): void {
    const normalized = normalizeUiScale(scale);
    if (appliedUiScale === normalized) return;
    appliedUiScale = normalized;

    try {
      getCurrentWebview().setZoom(normalized).catch((err: unknown) => {
        console.warn('Failed to apply UI scale:', err);
      });
    } catch (err) {
      console.warn('Failed to apply UI scale:', err);
    }
  }

  function setUiScale(nextScale: number): void {
    uiScale.set(normalizeUiScale(nextScale));
  }

  function adjustUiScale(stepCount: number): void {
    setUiScale($uiScale + stepCount * UI_SCALE_STEP);
  }

  function goHome(): void {
    clearDocument();
    if ($tabsEnabled) clearTabs();
  }

  async function selectVaultFolder(): Promise<void> {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        openVault(selected);
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  }

  async function openVault(vaultPath: string): Promise<void> {
    sidebarRoot = '';
    await tick();
    sidebarRoot = vaultPath;
    indexVaultFiles(sidebarRoot).catch(err => console.error('Failed to index vault files:', err));
    addToRecentVaults(vaultPath);
  }

  /** Cache of all .md files in the vault for wikilink resolution */
  let vaultFiles: Array<{name: string; path: string}> = [];

  /** Rebuild vault file index when sidebarRoot changes */
  async function indexVaultFiles(root: string): Promise<void> {
    if (!root) { vaultFiles = []; return; }
    try {
      vaultFiles = await listMarkdownFiles(root);
    } catch {
      vaultFiles = [];
    }
  }

  /**
   * Resolve a wikilink page name to a full file path.
   * Search order: same directory → vault-wide by filename match.
   */
  function resolveWikilink(pageName: string, currentFilePath: string): string | null {
    const decoded = decodeURIComponent(pageName);
    const basePath = currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    // 1. Try same directory
    const sameDirPath = `${basePath}/${decoded}.md`;
    const sameDirMatch = vaultFiles.find(f => f.path.replace(/\\/g, '/') === sameDirPath);
    if (sameDirMatch) return sameDirMatch.path;

    // 2. Search vault by filename (case-insensitive)
    const targetName = decoded.toLowerCase();
    const match = vaultFiles.find(f => {
      const fname = f.name.replace(/\.md$/i, '').toLowerCase();
      return fname === targetName;
    });
    if (match) return match.path;

    return null;
  }

  function handleNavigate(event: CustomEvent<{ path: string; anchor?: string | null }>): void {
    loadFile(event.detail.path, event.detail.anchor || null);
  }

  function handleSidebarNavigate(event: CustomEvent<{ path: string }>): void {
    loadFile(event.detail.path);
  }

  let showFindBar: boolean = false;
  let findQuery: string = '';
  let findInput: HTMLInputElement;

  function handleKeydown(event: KeyboardEvent): void {
    if (handleZoomKeydown(event)) return;

    // Ctrl+Shift+F → focus vault search
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      if (sidebarRef?.focusSearch) {
        sidebarRef.focusSearch();
      }
      return;
    }
    // Ctrl+F → in-document find
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'f') {
      event.preventDefault();
      showFindBar = true;
      setTimeout(() => findInput?.focus(), 50);
      return;
    }
    // Escape → close find bar
    if (event.key === 'Escape' && showFindBar) {
      showFindBar = false;
      findQuery = '';
      // Clear selection highlight
      if (window.getSelection) window.getSelection()?.removeAllRanges();
    }
  }

  function handleZoomKeydown(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;

    const key = event.key.toLowerCase();
    const code = event.code;
    const zoomIn = key === '=' || key === '+' || code === 'Equal' || code === 'NumpadAdd';
    const zoomOut = key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract';
    const reset = key === '0' || code === 'Digit0' || code === 'Numpad0';

    if (!zoomIn && !zoomOut && !reset) return false;

    event.preventDefault();
    if (zoomIn) adjustUiScale(1);
    if (zoomOut) adjustUiScale(-1);
    if (reset) setUiScale(1);
    return true;
  }

  function handleWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return;

    event.preventDefault();
    const now = Date.now();
    if (now - lastZoomWheelAt < 80) return;

    lastZoomWheelAt = now;
    adjustUiScale(event.deltaY < 0 ? 1 : -1);
  }

  function findNext(): void {
    if (!findQuery.trim()) return;
    // @ts-ignore — window.find is non-standard but supported in all WebView2/WebKit
    window.find(findQuery, false, false, true, false, false, false);
  }

  function findPrev(): void {
    if (!findQuery.trim()) return;
    // @ts-ignore
    window.find(findQuery, false, true, true, false, false, false);
  }

  function handleFindKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        findPrev();
      } else {
        findNext();
      }
    }
    if (event.key === 'Escape') {
      showFindBar = false;
      findQuery = '';
      if (window.getSelection) window.getSelection()?.removeAllRanges();
    }
  }

  onMount((): (() => void) => {
    let cleanups: Array<() => void> = [];

    // Global error boundary — prevent white screen on unhandled exceptions
    const errorHandler = (event: ErrorEvent) => {
      console.error('[global] Unhandled error:', event.error);
      event.preventDefault();
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('[global] Unhandled rejection:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    cleanups.push(() => window.removeEventListener('error', errorHandler));
    cleanups.push(() => window.removeEventListener('unhandledrejection', rejectionHandler));

    // On mount, check if this window has a file to load.
    // New windows store their file path in localStorage keyed by window label.
    const myLabel = getCurrentWindow().label;
    const storageKey = `__feathermark_window_${myLabel}`;
    const windowFile = localStorage.getItem(storageKey);

    if (windowFile) {
      // New window — load the file and clean up
      localStorage.removeItem(storageKey);
      console.log('Loading window file:', windowFile);
      loadFile(windowFile).catch((err: unknown) => {
        console.error('[new-window] Failed to load file:', err);
        setError(windowFile, String(err));
      });
    } else if ((window as any).__FEATHERMARK_FILE__) {
      // Fallback: initialization_script injection (for single-instance / CLI opens)
      const injectedFile = (window as any).__FEATHERMARK_FILE__ as string;
      console.log('Loading injected file:', injectedFile);
      loadFile(injectedFile).catch((err: unknown) => {
        console.error('[new-window] Failed to load file:', err);
        setError(injectedFile, String(err));
      });
    } else {
      // Main window — check for cold-start pending file
      invoke<string | null>('get_pending_file_path').then((pendingPath: string | null) => {
        if (pendingPath) {
          console.log('Loading pending file from cold start:', pendingPath);
          loadFile(pendingPath);
        }
      }).catch(() => {
        console.log('No pending file path');
      });
    }

    listen<string>('open-file', async (event) => {
      console.log('Open file event received:', event.payload);
      await loadFile(event.payload);
    }).then(unlisten => cleanups.push(unlisten));

    listen<string>('file-changed', async (event) => {
      console.log('File changed externally:', event.payload);
      const changedPath = event.payload.replace(/\\/g, '/');
      const activeFilePath = ($tabsEnabled && $activeTab ? $activeTab.filePath : $documentState.filePath || '').replace(/\\/g, '/');
      if (changedPath === activeFilePath) {
        fileModifiedExternally = true;
      }
    }).then(unlisten => cleanups.push(unlisten));

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} on:wheel|nonpassive={handleWheel} />

<main class="app" class:dark={$theme === 'dark'}>
  <header class="header">
    {#if fileModifiedExternally}
      <div class="file-modified-banner">
        <span>File has been modified externally</span>
        <button on:click={() => loadFile(displayFilePath)}>Refresh</button>
      </div>
    {/if}
    <div class="header-inner">
      <div class="title">
        {#if displayStatus === 'ready'}
          <button class="header-btn" on:click={goHome} title="Back to home">
            ←
          </button>
        {/if}
        <span class="doc-title">{displayTitle || 'Feathermark'}</span>
      </div>
      <div class="header-actions">
        {#if displayStatus === 'ready'}
          <button class="header-btn" on:click={handleOpenInEditor} title="Open in external editor">
            ✏️
          </button>
        {/if}
        <button class="header-btn" on:click={selectVaultFolder} title="Open vault folder">
          📂
        </button>
        <button class="header-btn" on:click={toggleTheme} title="Toggle theme">
          {$theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button class="header-btn" on:click={() => showSettings = true} title="Settings">
          ⚙️
        </button>
      </div>
    </div>
  </header>

  <div class="workspace">
    {#if sidebarRoot}
      <Sidebar rootPath={sidebarRoot} on:navigate={handleSidebarNavigate} bind:this={sidebarRef} />
    {/if}

    <div class="main-area">
      {#if $tabsEnabled}
        <TabBar />
      {/if}

      {#if showFindBar}
        <div class="find-bar">
          <input
            type="text"
            placeholder="Find in document..."
            bind:value={findQuery}
            bind:this={findInput}
            on:keydown={handleFindKeydown}
            on:input={() => { if (findQuery) findNext(); }}
          />
          <button class="find-btn" on:click={findPrev} title="Previous (Shift+Enter)">▲</button>
          <button class="find-btn" on:click={findNext} title="Next (Enter)">▼</button>
          <button class="find-btn" on:click={() => { showFindBar = false; findQuery = ''; if (window.getSelection) window.getSelection()?.removeAllRanges(); }} title="Close (Esc)">✕</button>
        </div>
      {/if}

      <div class="content">
        {#if displayStatus === 'loading'}
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading...</span>
          </div>
        {:else if displayStatus === 'error'}
          <div class="error">
            <h2>Error Loading Document</h2>
            <p>{errorMessage || $documentState.error}</p>
            {#if displayFilePath}
              <button on:click={() => loadFile(displayFilePath)}>Retry</button>
            {/if}
          </div>
        {:else if displayStatus === 'ready' && displayContent}
          {#key renderKey}
            <MarkdownView
              content={displayContent}
              filePath={displayFilePath}
              isDark={$theme === 'dark'}
              vaultRoot={sidebarRoot}
              on:navigate={handleNavigate}
            />
          {/key}
        {:else}
          <div class="welcome">
            <h1>Feathermark</h1>
            <p class="welcome-sub">A lightweight Markdown reader</p>

            <div class="welcome-actions">
              <button class="welcome-btn primary" on:click={selectVaultFolder}>
                📂 Open Folder
              </button>
            </div>

            {#if $recentVaults.length > 0 || $recentFiles.length > 0}
              <div class="recent-section">
                <div class="recent-tabs">
                  <button
                    class="tab-btn"
                    class:active={recentTab === 'vaults'}
                    on:click={() => recentTab = 'vaults'}
                  >
                    Vaults {#if $recentVaults.length > 0}<span class="tab-count">{$recentVaults.length}</span>{/if}
                  </button>
                  <button
                    class="tab-btn"
                    class:active={recentTab === 'files'}
                    on:click={() => recentTab = 'files'}
                  >
                    Files {#if $recentFiles.length > 0}<span class="tab-count">{$recentFiles.length}</span>{/if}
                  </button>
                </div>

                <div class="recent-list">
                  {#if recentTab === 'vaults'}
                    {#if $recentVaults.length > 0}
                      <ul>
                        {#each $recentVaults as vault}
                          <li>
                            <button class="vault-entry" on:click={() => openVault(vault)}>
                              <span class="vault-name">{getFolderName(vault)}</span>
                              <span class="vault-path">{vault}</span>
                            </button>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-hint">No recent vaults</p>
                    {/if}
                  {:else}
                    {#if $recentFiles.length > 0}
                      <ul>
                        {#each $recentFiles as file}
                          <li><button on:click={() => loadFile(file)}>{file.replace(/\\/g, '/').split('/').pop()}</button></li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-hint">No recent files</p>
                    {/if}
                  {/if}
                </div>
              </div>

              <button class="clear-btn" on:click={clearAllRecents} title="Clear all recent items">🗑️ Clear</button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</main>

{#if showSettings}
  <SettingsModal on:close={() => showSettings = false} on:settingsChanged={handleSettingsChanged} />
{/if}

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    transition: background-color 0.3s, color 0.3s;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #ffffff;
    color: #333333;
  }

  .app.dark {
    background: #1e1e1e;
    color: #e0e0e0;
  }

  .header {
    display: flex;
    flex-direction: column;
    padding: 0;
    border-bottom: 1px solid #e0e0e0;
    background: #f6f6f6;
  }

  .file-modified-banner {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    background: #fff3cd;
    color: #856404;
    font-size: 0.9rem;
  }

  :global(.dark) .file-modified-banner {
    background: #3d3d2d;
    color: #e0d8b0;
  }

  .file-modified-banner button {
    padding: 4px 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .file-modified-banner button:hover {
    background: var(--accent-hover);
  }

  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    flex: 1;
  }

  :global(.dark) .header {
    border-bottom-color: #333333;
    background: #252526;
  }

  .title {
    font-weight: 600;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .doc-title {
    color: inherit;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-btn {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  :global(.dark) .header-btn {
    color: #f5f5f5;
  }

  .header-btn:hover {
    background: rgba(0,0,0,0.1);
  }

  :global(.dark) .header-btn:hover {
    background: rgba(255,255,255,0.1);
  }

  .workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    overflow: auto;
    padding: 20px;
  }

  /* Find bar */
  .find-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: #f6f6f6;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  :global(.dark) .find-bar {
    background: #252526;
    border-bottom-color: #333;
  }

  .find-bar input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
    background: #fff;
    color: #333;
    outline: none;
  }

  .find-bar input:focus {
    border-color: var(--accent);
  }

  :global(.dark) .find-bar input {
    background: #1e1e1e;
    border-color: #555;
    color: #e0e0e0;
  }

  .find-btn {
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    color: #666;
  }

  .find-btn:hover {
    background: #e0e0e0;
  }

  :global(.dark) .find-btn {
    border-color: #555;
    color: #aaa;
  }

  :global(.dark) .find-btn:hover {
    background: #333;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e0e0e0;
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: #cc0000;
  }

  .error button {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }

  .welcome h1 {
    font-size: 2.5rem;
    margin-bottom: 4px;
  }

  .welcome-sub {
    color: #888;
    margin-bottom: 32px;
    font-size: 0.95rem;
  }

  .welcome-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 32px;
  }

  .welcome-btn {
    padding: 10px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    border: 1px solid #ddd;
    background: #f6f6f6;
    color: #333;
    transition: all 0.2s;
  }

  .welcome-btn:hover {
    background: #e8e8e8;
  }

  .welcome-btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .welcome-btn.primary:hover {
    background: var(--accent-hover);
  }

  :global(.dark) .welcome-btn {
    background: #333;
    border-color: #555;
    color: #e0e0e0;
  }

  :global(.dark) .welcome-btn:hover {
    background: #444;
  }

  :global(.dark) .welcome-btn.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  :global(.dark) .welcome-btn.primary:hover {
    background: var(--accent-hover);
  }

  .recent-section {
    padding: 0;
    background: #f6f6f6;
    border-radius: 8px;
    width: 100%;
    max-width: 320px;
    overflow: hidden;
  }

  :global(.dark) .recent-section {
    background: #252526;
  }

  .recent-tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
  }

  :global(.dark) .recent-tabs {
    border-bottom-color: #444;
  }

  .tab-btn {
    flex: 1;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 0.8rem;
    color: #999;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .tab-btn:hover {
    color: #666;
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    font-weight: 600;
  }

  :global(.dark) .tab-btn {
    color: #666;
  }

  :global(.dark) .tab-btn:hover {
    color: #aaa;
  }

  :global(.dark) .tab-btn.active {
    color: var(--accent-dark);
    border-bottom-color: var(--accent-dark);
  }

  .tab-count {
    font-size: 0.65rem;
    background: var(--accent-bg);
    color: var(--accent);
    padding: 1px 5px;
    border-radius: 8px;
    font-weight: 600;
  }

  :global(.dark) .tab-count {
    background: var(--accent-bg-strong);
    color: var(--accent-dark);
  }

  .recent-list {
    padding: 8px 12px 12px;
    max-height: 220px;
    overflow-y: auto;
  }

  .recent-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .recent-list li {
    margin: 2px 0;
  }

  .recent-list li button {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-align: left;
    padding: 4px 8px;
    border-radius: 4px;
    width: 100%;
    font-size: 0.85rem;
  }

  .recent-list li button:hover {
    background: var(--accent-bg);
  }

  .empty-hint {
    color: #999;
    font-size: 0.8rem;
    text-align: center;
    padding: 12px 0;
  }

  .clear-btn {
    background: none;
    border: 1px solid #ddd;
    color: #999;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 5px 16px;
    border-radius: 4px;
    transition: all 0.2s;
    margin-top: 12px;
  }

  .clear-btn:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  :global(.dark) .clear-btn {
    border-color: #555;
    color: #777;
  }

  :global(.dark) .clear-btn:hover {
    background: #3a1a1a;
    border-color: #dc2626;
    color: #f87171;
  }

  .vault-entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px !important;
  }

  .vault-name {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .vault-path {
    font-size: 0.75rem;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.dark) .vault-path {
    color: #777;
  }

</style>
