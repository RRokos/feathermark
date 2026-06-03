<script lang="ts">
  import { tabs, activeTabId, setActiveTab, removeTab } from '$lib/stores/tabs.js';

  function handleClick(tabId: string): void {
    setActiveTab(tabId);
  }

  function handleClose(event: MouseEvent, tabId: string): void {
    event.stopPropagation();
    removeTab(tabId);
  }

  function getShortName(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }
</script>

<div class="tabbar">
  {#each $tabs as tab (tab.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="tab"
      class:active={tab.id === $activeTabId}
      on:click={() => handleClick(tab.id)}
      title={tab.filePath}
    >
      <span class="tab-name">{tab.title || getShortName(tab.filePath)}</span>
      <button class="tab-close" on:click={(e) => handleClose(e, tab.id)} title="Close tab">✕</button>
    </div>
  {/each}
</div>

<style>
  .tabbar {
    display: flex;
    background: #f0f0f0;
    border-bottom: 1px solid #e0e0e0;
    overflow-x: auto;
    min-height: 35px;
    flex-shrink: 0;
  }

  :global(.dark) .tabbar {
    background: #1e1e1e;
    border-bottom-color: #333;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    border-right: 1px solid #e0e0e0;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    max-width: 180px;
    transition: background 0.15s;
  }

  :global(.dark) .tab {
    border-right-color: #333;
    color: #888;
  }

  .tab:hover {
    background: rgba(100, 108, 255, 0.06);
  }

  .tab.active {
    background: #fff;
    color: #333;
    border-bottom: 2px solid var(--accent, #646cff);
  }

  :global(.dark) .tab.active {
    background: #2d2d2d;
    color: #e0e0e0;
  }

  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab.active .tab-close {
    opacity: 0.7;
  }

  .tab-close:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #cc0000;
    opacity: 1 !important;
  }

  :global(.dark) .tab-close:hover {
    background: rgba(255, 255, 255, 0.1);
  }
</style>
