<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { open } from '@tauri-apps/plugin-dialog';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MarkdownView from '$lib/components/MarkdownView.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import {
    documentState, theme, recentFiles,
    setDocument, setLoading, setError, clearDocument, addToRecentFiles, clearRecentFiles
  } from '$lib/stores/document.js';
  import {
    tabsEnabled, activeTab, activeTabId,
    addTab, removeTab, saveScrollPos, clearTabs
  } from '$lib/stores/tabs.js';
  import { openFile, watchFile, openInEditor, listMarkdownFiles } from '$lib/services/file.js';

  let errorMessage: string = '';
  let sidebarRoot: string = '';
  let fileModifiedExternally: boolean = false;
  let sidebarRef: any = null;
  let showSettings: boolean = false;
  let contentEl: HTMLDivElement;
  let renderKey: number = 0;

  function handleSettingsChanged(): void {
    renderKey++;
  }

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

  let _loadGeneration = 0;

  async function loadFile(filePath: string, anchor: string | null = null): Promise<void> {
    const gen = ++_loadGeneration;
    let cleanPath: string = filePath;
    let scrollAnchor: string | null = anchor;

    if (filePath.includes('#')) {
      const parts: string[] = filePath.split('#');
      cleanPath = parts[0];
      scrollAnchor = parts.slice(1).join('#') || null;
    }

    setLoading(cleanPath);
    errorMessage = '';

    try {
      const result: { content: string; path: string } = await openFile(cleanPath);
      if (gen !== _loadGeneration) return;

      if ($tabsEnabled) {
        addTab(result.path, result.content);
      } else {
        setDocument(result.path, result.content);
      }

      fileModifiedExternally = false;
      watchFile(window as Window, result.path).catch(() => {});
      addToRecentFiles(result.path);
      if (scrollAnchor) scrollToAnchor(scrollAnchor);
    } catch (err: unknown) {
      if (gen !== _loadGeneration) return;

      const rawFileName = cleanPath.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/, '') || '';
      const fileName = decodeURIComponent(rawFileName);
      const currentFile = $tabsEnabled && $activeTab ? $activeTab.filePath : ($documentState.filePath || '');
      const resolved = resolveWikilink(fileName, currentFile);

      if (resolved && resolved !== cleanPath) {
        try {
          const result2 = await openFile(resolved);
          if (gen !== _loadGeneration) return;

          if ($tabsEnabled) {
            addTab(result2.path, result2.content);
          } else {
            setDocument(result2.path, result2.content);
          }

          fileModifiedExternally = false;
          watchFile(window as Window, result2.path).catch(() => {});
          addToRecentFiles(result2.path);
          if (scrollAnchor) scrollToAnchor(scrollAnchor);
          return;
        } catch {
          if (gen !== _loadGeneration) return;
        }
      }

      const displayName = fileName || cleanPath;
      errorMessage = `"${displayName}" not found in vault`;
      if ($tabsEnabled) {
        clearDocument();
      } else {
        setError(cleanPath, errorMessage);
      }
    }
  }

  function scrollToAnchor(anchor: string): void {
    setTimeout(() => {
      const heading: Element | null = document.getElementById(anchor) ||
        document.querySelector(`[id="${anchor}"]`);
      if (heading) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  }

  function toggleTheme(): void {
    theme.update((current: string): string => current === 'light' ? 'dark' : 'light');
  }

  function goHome(): void {
    clearDocument();
    if ($tabsEnabled) clearTabs();
  }

  async function selectVaultFolder(): Promise<void> {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      sidebarRoot = '';
      await new Promise(r => setTimeout(r, 50));
      sidebarRoot = selected;
      indexVaultFiles(sidebarRoot);
    }
  }

  let vaultFiles: Array<{name: string; path: string}> = [];

  async function indexVaultFiles(root: string): Promise<void> {
    if (!root) { vaultFiles = []; return; }
    try {
      vaultFiles = await listMarkdownFiles(root);
    } catch {
      vaultFiles = [];
    }
  }

  function resolveWikilink(pageName: string, currentFilePath: string): string | null {
    const decoded = decodeURIComponent(pageName);
    const basePath = currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    for (const ext of ['.md', '.markdown']) {
      const sameDirPath = `${basePath}/${decoded}${ext}`;
      const sameDirMatch = vaultFiles.find(f => f.path.replace(/\\/g, '/') === sameDirPath);
      if (sameDirMatch) return sameDirMatch.path;
    }

    const targetName = decoded.toLowerCase();
    const match = vaultFiles.find(f => {
      const fname = f.name.replace(/\.(md|markdown)$/i, '').toLowerCase();
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
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      if (sidebarRef?.focusSearch) {
        sidebarRef.focusSearch();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'f') {
      event.preventDefault();
      showFindBar = true;
      setTimeout(() => findInput?.focus(), 50);
      return;
    }
    if (event.key === 'Escape' && showFindBar) {
      showFindBar = false;
      findQuery = '';
      if (window.getSelection) window.getSelection()?.removeAllRanges();
    }
  }

  function findNext(): void {
    if (!findQuery.trim()) return;
    // @ts-ignore
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
      if (event.shiftKey) findPrev(); else findNext();
    }
    if (event.key === 'Escape') {
      showFindBar = false;
      findQuery = '';
      if (window.getSelection) window.getSelection()?.removeAllRanges();
    }
  }

  onMount((): (() => void) => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileFromQuery = urlParams.get('file');

    if (fileFromQuery) {
      const decoded = decodeURIComponent(fileFromQuery);
      setTimeout(() => { loadFile(decoded); }, 150);
    } else {
      const pendingTimeout = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      Promise.race([invoke<string | null>('get_pending_file_path'), pendingTimeout])
        .then((pendingPath: string | null) => {
          if (pendingPath) loadFile(pendingPath);
        })
        .catch(() => {});
    }

    const listenerPromise = Promise.all([
      listen<string>('open-file', (event) => {
        loadFile(event.payload);
      }),
      listen<string>('file-changed', (event) => {
        const changedPath = event.payload;
        const currentFilePath = $tabsEnabled && $activeTab
          ? $activeTab.filePath
          : $documentState.filePath;
        if (changedPath === currentFilePath) {
          fileModifiedExternally = true;
        }
      })
    ]);

    return () => {
      listenerPromise.then(([un1, un2]) => { un1(); un2(); });
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<main class="app" class:dark={$theme === 'dark'}>
  <header class="header">
    {#if fileModifiedExternally}
      <div class="file-modified-banner">
        <span>File has been modified externally</span>
        <button on:click={() => {
          const path = $tabsEnabled && $activeTab ? $activeTab.filePath : $documentState.filePath;
          if (path) loadFile(path);
        }}>Refresh</button>
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

      <div class="content" bind:this={contentEl}>
        {#if displayStatus === 'loading'}
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading...</span>
          </div>
        {:else if displayStatus === 'error'}
          <div class="error">
            <h2>Error Loading Document</h2>
            <p>{errorMessage || $documentState.error}</p>
            {#if $documentState.filePath}
              <button on:click={() => loadFile($documentState.filePath || '')}>Retry</button>
            {/if}
          </div>
        {:else if displayStatus === 'ready' && displayContent}
          {#key renderKey}
            <MarkdownView
              content={displayContent}
              filePath={displayFilePath}
              isDark={$theme === 'dark'}
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

            {#if $recentFiles.length > 0}
              <div class="recent-files">
                <div class="recent-header">
                  <h3>Recent</h3>
                  <button class="clear-btn" on:click={clearRecentFiles} title="Clear recent files">🗑️ Clear</button>
                </div>
                <ul>
                  {#each $recentFiles.slice(0, 5) as file}
                    <li><button on:click={() => loadFile(file)}>{file.replace(/\\/g, '/').split('/').pop()}</button></li>
                  {/each}
                </ul>
              </div>
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
    background: #646cff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .file-modified-banner button:hover {
    background: #5558e0;
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
    font-size: 1.2rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 4px;
    transition: background 0.2s;
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
    border-color: #646cff;
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
    border-top-color: #646cff;
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
    background: #646cff;
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
    background: #646cff;
    color: white;
    border-color: #646cff;
  }

  .welcome-btn.primary:hover {
    background: #5558e0;
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
    background: #646cff;
    color: white;
    border-color: #646cff;
  }

  :global(.dark) .welcome-btn.primary:hover {
    background: #5558e0;
  }

  .recent-files {
    padding: 16px;
    background: #f6f6f6;
    border-radius: 8px;
    width: 100%;
    max-width: 320px;
  }

  :global(.dark) .recent-files {
    background: #252526;
  }

  .recent-files h3 {
    font-size: 0.9rem;
    margin-bottom: 8px;
  }

  .recent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .recent-header h3 {
    font-size: 0.85rem;
    margin-bottom: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
  }

  .clear-btn {
    background: none;
    border: 1px solid #ddd;
    color: #888;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  :global(.dark) .clear-btn {
    border-color: #555;
  }

  :global(.dark) .clear-btn:hover {
    background: #3a1a1a;
    border-color: #dc2626;
    color: #f87171;
  }

  .recent-files ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .recent-files li {
    margin: 4px 0;
  }

  .recent-files button {
    background: none;
    border: none;
    color: #646cff;
    cursor: pointer;
    text-align: left;
    padding: 4px 8px;
    border-radius: 4px;
    width: 100%;
  }

  .recent-files button:hover {
    background: rgba(100, 108, 255, 0.1);
  }

</style>
