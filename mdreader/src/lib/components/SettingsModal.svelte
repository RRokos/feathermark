<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';
  import { tabsEnabled } from '$lib/stores/tabs.js';
  import { accentColor } from '$lib/stores/document.js';

  const dispatch = createEventDispatcher<{ close: void; settingsChanged: void }>();

  const EDITOR_KEY = 'mdreader_editor';
  const TABS_KEY = 'mdreader_tabs_enabled';
  const MERMAID_FIT_KEY = 'mdreader_mermaid_fit';

  type EditorPreset = { label: string; command: string; description: string };

  const presets: EditorPreset[] = [
    { label: 'VS Code', command: 'code', description: 'Visual Studio Code' },
    { label: 'Notepad++', command: 'notepad++', description: 'Notepad++' },
    { label: 'Notepad', command: 'notepad', description: 'Windows Notepad' },
  ];

  let selectedPreset: string = '';
  let customPath: string = '';
  let useCustom: boolean = false;
  let enableTabs: boolean = false;
  let mermaidFitWidth: boolean = false;
  let selectedAccent: string = '#646cff';

  const accentPresets = [
    '#646cff', '#7c3aed', '#6366f1', '#0ea5e9',
    '#14b8a6', '#22c55e', '#eab308', '#f97316',
    '#ef4444', '#ec4899', '#a855f7', '#6b7280'
  ];

  onMount(() => {
    const saved = localStorage.getItem(EDITOR_KEY) || '';
    const found = presets.find(p => p.command === saved);
    if (found) {
      selectedPreset = found.command;
      useCustom = false;
    } else if (saved) {
      customPath = saved;
      useCustom = true;
    } else {
      selectedPreset = presets[0]?.command || '';
      useCustom = false;
    }

    enableTabs = localStorage.getItem(TABS_KEY) === 'true';
    mermaidFitWidth = localStorage.getItem(MERMAID_FIT_KEY) === 'true';
    selectedAccent = localStorage.getItem('mdreader_accent_color') || '#646cff';
  });

  async function browseEditor(): Promise<void> {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Executable', extensions: ['exe'] }]
    });
    if (selected && typeof selected === 'string') {
      customPath = selected;
    }
  }

  function save(): void {
    const value = useCustom ? customPath.trim() : selectedPreset;
    if (value) {
      localStorage.setItem(EDITOR_KEY, value);
    } else {
      localStorage.removeItem(EDITOR_KEY);
    }

    localStorage.setItem(TABS_KEY, String(enableTabs));
    tabsEnabled.set(enableTabs);

    localStorage.setItem(MERMAID_FIT_KEY, String(mermaidFitWidth));

    accentColor.set(selectedAccent);

    dispatch('settingsChanged');
    dispatch('close');
  }

  function cancel(): void {
    dispatch('close');
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      cancel();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') cancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop" on:click={handleBackdropClick}>
  <div class="modal">
    <div class="modal-header">
      <h3>Settings</h3>
      <button class="close-btn" on:click={cancel}>✕</button>
    </div>

    <div class="modal-body">
      <div class="section">
        <h4>External Editor</h4>
        <p class="hint">Click ✏️ or right-click a file to open it with this editor.</p>

        <div class="radio-group">
          {#each presets as preset}
            <label class="radio-item" class:selected={!useCustom && selectedPreset === preset.command}>
              <input
                type="radio"
                name="editor"
                value={preset.command}
                checked={!useCustom && selectedPreset === preset.command}
                on:change={() => { selectedPreset = preset.command; useCustom = false; }}
              />
              <span class="radio-label">{preset.label}</span>
              <span class="radio-desc">{preset.description}</span>
            </label>
          {/each}

          <label class="radio-item" class:selected={useCustom}>
            <input
              type="radio"
              name="editor"
              value="__custom__"
              checked={useCustom}
              on:change={() => { useCustom = true; }}
            />
            <span class="radio-label">Custom</span>
          </label>
        </div>

        {#if useCustom}
          <div class="custom-input">
            <input
              type="text"
              placeholder="e.g. C:\Program Files\Notepad++\notepad++.exe"
              bind:value={customPath}
            />
            <button class="browse-btn" on:click={browseEditor}>Browse...</button>
          </div>
        {/if}
      </div>

      <div class="section section-divider">
        <h4>Tabs</h4>
        <p class="hint">Open multiple files in browser-style tabs.</p>
        <label class="toggle-item">
          <input type="checkbox" bind:checked={enableTabs} />
          <span>Enable tabs</span>
        </label>
      </div>

      <div class="section section-divider">
        <h4>Mermaid</h4>
        <label class="toggle-item">
          <input type="checkbox" bind:checked={mermaidFitWidth} />
          <span>Fit diagram to text width</span>
        </label>
        <p class="hint">{mermaidFitWidth ? 'Diagrams scale to fit the text column.' : 'Diagrams keep original size, scroll horizontally if wider.'}</p>
      </div>

      <div class="section section-divider">
        <h4>Accent Color</h4>
        <p class="hint">Choose a theme accent color for the interface.</p>
        <div class="color-palette">
          {#each accentPresets as color}
            <button
              class="color-swatch"
              class:selected={selectedAccent === color}
              style="background: {color}"
              on:click={() => selectedAccent = color}
              title={color}
            >
              {#if selectedAccent === color}
                <span class="check-mark">✓</span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="custom-color">
          <label class="custom-color-label" for="accent-color-picker">Custom:</label>
          <input
            id="accent-color-picker"
            type="color"
            value={selectedAccent}
            on:input={(e) => selectedAccent = e.currentTarget.value}
            class="color-input"
          />
          <span class="color-hex">{selectedAccent}</span>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={cancel}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal {
    background: #fff;
    border-radius: 8px;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  :global(.dark) .modal {
    background: #2d2d2d;
    color: #e0e0e0;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  :global(.dark) .modal-header {
    border-bottom-color: #444;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #888;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }

  :global(.dark) .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .modal-body {
    padding: 20px;
  }

  .section h4 {
    margin: 0 0 4px;
    font-size: 0.95rem;
  }

  .hint {
    color: #888;
    font-size: 0.8rem;
    margin: 0 0 12px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .radio-item:hover {
    background: var(--accent-bg);
  }

  .radio-item.selected {
    background: var(--accent-bg);
  }

  .radio-item input[type="radio"] {
    accent-color: var(--accent);
  }

  .radio-label {
    font-weight: 500;
    font-size: 0.9rem;
    min-width: 80px;
  }

  .radio-desc {
    color: #888;
    font-size: 0.8rem;
  }

  .custom-input input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
    background: #fff;
    color: #333;
  }

  .custom-input {
    margin-top: 8px;
    padding-left: 28px;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .custom-input input:focus {
    outline: none;
    border-color: var(--accent);
  }

  :global(.dark) .custom-input input {
    background: #1e1e1e;
    border-color: #555;
    color: #e0e0e0;
  }

  .browse-btn {
    padding: 6px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f0f0f0;
    cursor: pointer;
    font-size: 0.8rem;
    white-space: nowrap;
    color: #333;
  }

  .browse-btn:hover {
    background: #e0e0e0;
  }

  :global(.dark) .browse-btn {
    background: #3a3a3a;
    border-color: #555;
    color: #e0e0e0;
  }

  :global(.dark) .browse-btn:hover {
    background: #4a4a4a;
  }

  .section-divider {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  }

  :global(.dark) .section-divider {
    border-top-color: #444;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .toggle-item:hover {
    background: var(--accent-bg);
  }

  .toggle-item input[type="checkbox"] {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid #e0e0e0;
  }

  :global(.dark) .modal-footer {
    border-top-color: #444;
  }

  .btn {
    padding: 6px 16px;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    border: none;
  }

  .color-palette {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .color-swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .color-swatch:hover {
    transform: scale(1.15);
  }

  .color-swatch.selected {
    border-color: #333;
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px #333;
  }

  :global(.dark) .color-swatch.selected {
    border-color: #e0e0e0;
    box-shadow: 0 0 0 2px #1e1e1e, 0 0 0 4px #e0e0e0;
  }

  .check-mark {
    color: #fff;
    font-size: 0.8rem;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .custom-color {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .custom-color-label {
    font-size: 0.85rem;
    color: #888;
  }

  .color-input {
    width: 36px;
    height: 30px;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    padding: 2px;
  }

  :global(.dark) .color-input {
    border-color: #555;
  }

  .color-hex {
    font-size: 0.8rem;
    color: #888;
    font-family: monospace;
  }

  .btn-secondary {
    background: #e0e0e0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #d0d0d0;
  }

  :global(.dark) .btn-secondary {
    background: #444;
    color: #e0e0e0;
  }

  :global(.dark) .btn-secondary:hover {
    background: #555;
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }
</style>
