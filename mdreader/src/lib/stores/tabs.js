import { writable, derived, get } from 'svelte/store';

// ─── Tabs enabled toggle ─────────────────────────────────────────────

const TABS_KEY = 'mdreader_tabs_enabled';

function loadTabsEnabled() {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(TABS_KEY) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

export const tabsEnabled = writable(loadTabsEnabled());
tabsEnabled.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(TABS_KEY, String(val)); } catch {}
  }
});

// ─── Tab state ────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id: string,
 *   filePath: string,
 *   title: string,
 *   content: string,
 *   frontmatter: Record<string,any>|null,
 *   scrollPos: number
 * }} Tab
 */

/** @type {import('svelte/store').Writable<Tab[]>} */
export const tabs = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const activeTabId = writable(null);

/** Derived: the currently active tab object */
export const activeTab = derived(
  [tabs, activeTabId],
  ([$tabs, $activeTabId]) => $tabs.find(t => t.id === $activeTabId) || null
);

let tabCounter = 0;

/**
 * @param {string} filePath
 * @returns {string}
 */
function getTitle(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  return name.replace(/\.md$/, '');
}

/**
 * Add a new tab or switch to existing one if file already open
 * @param {string} filePath
 * @param {string} content
 * @param {Record<string,any>|null} [frontmatter]
 * @returns {string} tab id
 */
export function addTab(filePath, content, frontmatter = null) {
  const currentTabs = get(tabs);
  const normalized = filePath.replace(/\\/g, '/');

  // Check if file already has a tab
  const existing = currentTabs.find(t => t.filePath.replace(/\\/g, '/') === normalized);
  if (existing) {
    // Update content and switch to it
    tabs.update(all => all.map(t =>
      t.id === existing.id ? { ...t, content, frontmatter, title: /** @type {any} */ (frontmatter)?.title || getTitle(filePath) } : t
    ));
    activeTabId.set(existing.id);
    return existing.id;
  }

  // Create new tab
  const id = `tab-${++tabCounter}`;
  /** @type {Tab} */
  const newTab = {
    id,
    filePath,
    title: /** @type {any} */ (frontmatter)?.title || getTitle(filePath),
    content,
    frontmatter,
    scrollPos: 0
  };

  tabs.update(all => [...all, newTab]);
  activeTabId.set(id);
  return id;
}

/**
 * Close a tab by id
 * @param {string} tabId
 */
export function removeTab(tabId) {
  const currentTabs = get(tabs);
  const idx = currentTabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;

  const wasActive = get(activeTabId) === tabId;
  tabs.update(all => all.filter(t => t.id !== tabId));

  if (wasActive) {
    const remaining = get(tabs);
    if (remaining.length > 0) {
      // Switch to the nearest tab
      const newIdx = Math.min(idx, remaining.length - 1);
      activeTabId.set(remaining[newIdx].id);
    } else {
      activeTabId.set(null);
    }
  }
}

/**
 * Switch to a tab
 * @param {string} tabId
 */
export function setActiveTab(tabId) {
  activeTabId.set(tabId);
}

/**
 * Save scroll position for a tab
 * @param {string} tabId
 * @param {number} scrollPos
 */
export function saveScrollPos(tabId, scrollPos) {
  tabs.update(all => all.map(t =>
    t.id === tabId ? { ...t, scrollPos } : t
  ));
}

/**
 * Clear all tabs
 */
export function clearTabs() {
  tabs.set([]);
  activeTabId.set(null);
}
