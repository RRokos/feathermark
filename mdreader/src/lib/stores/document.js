import { writable, derived } from 'svelte/store';

/** @type {any} */
const initialDocState = {
  status: 'idle',
  filePath: null,
  content: null,
  frontmatter: null,
  title: null,
  error: null
};

// ─── Theme ─────────────────────────────────────────────────────────

const THEME_KEY = 'mdreader_theme';

function loadTheme() {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
}

export const theme = writable(loadTheme());
theme.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(THEME_KEY, val); } catch {}
  }
});

// ─── Accent color ────────────────────────────────────────────────────

const ACCENT_KEY = 'mdreader_accent_color';
const DEFAULT_ACCENT = '#646cff';

function loadAccentColor() {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
    } catch {
      return DEFAULT_ACCENT;
    }
  }
  return DEFAULT_ACCENT;
}

export const accentColor = writable(loadAccentColor());
accentColor.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(ACCENT_KEY, val); } catch {}
  }
  // Update CSS custom properties on :root
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--accent', val);
    root.style.setProperty('--accent-hover', shiftBrightness(val, -15));
    root.style.setProperty('--accent-light', shiftBrightness(val, 40));
    root.style.setProperty('--accent-dark', shiftBrightness(val, 20));
    root.style.setProperty('--accent-bg', hexToRgba(val, 0.1));
    root.style.setProperty('--accent-bg-strong', hexToRgba(val, 0.2));
  }
});

/**
 * Expand 3-digit hex (#abc) to 6-digit (#aabbcc)
 * @param {string} hex
 * @returns {string}
 */
function expandHex(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h}`;
}

/** @param {string} hex @param {number} amount */
function shiftBrightness(hex, amount) {
  const expanded = expandHex(hex);
  const num = parseInt(expanded.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** @param {string} hex @param {number} alpha */
function hexToRgba(hex, alpha) {
  const expanded = expandHex(hex);
  const num = parseInt(expanded.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Document state ─────────────────────────────────────────────────

export const documentState = writable(initialDocState);

// Recent files store with localStorage persistence
const STORAGE_KEY = 'mdreader_recent_files';

/**
 * @returns {string[]}
 */
function loadRecentFiles() {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter(f => typeof f === 'string') : [];
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {string[]} files
 */
function saveRecentFiles(files) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    } catch {}
  }
}

export const recentFiles = writable(loadRecentFiles());

/**
 * @param {string} filePath
 * @param {string} content
 * @param {Record<string, any>|null} [frontmatter]
 */
export function setDocument(filePath, content, frontmatter = null) {
  documentState.set({
    status: 'ready',
    filePath,
    content,
    frontmatter,
    title: /** @type {any} */ (frontmatter)?.title || getFileName(filePath),
    error: null
  });
  addToRecentFiles(filePath);
}

/**
 * @param {string} filePath
 */
export function setLoading(filePath) {
  documentState.set({
    status: 'loading',
    filePath,
    content: null,
    frontmatter: null,
    title: null,
    error: null
  });
}

/**
 * @param {string} filePath
 * @param {any} error
 */
export function setError(filePath, error) {
  documentState.set({
    status: 'error',
    filePath,
    content: null,
    frontmatter: null,
    title: null,
    error
  });
}

export function clearDocument() {
  documentState.set({ ...initialDocState });
}

/**
 * @param {string} filePath
 */
export function addToRecentFiles(filePath) {
  recentFiles.update(files => {
    const filtered = files.filter(f => f !== filePath);
    const updated = [filePath, ...filtered].slice(0, 10);
    saveRecentFiles(updated);
    return updated;
  });
}

/**
 * @param {string} filePath
 */
export function removeRecentFile(filePath) {
  recentFiles.update(files => {
    const updated = files.filter(f => f !== filePath);
    saveRecentFiles(updated);
    return updated;
  });
}

export function clearRecentFiles() {
  recentFiles.set([]);
  saveRecentFiles([]);
}

// ─── Recent vaults store ─────────────────────────────────────────────

const VAULT_STORAGE_KEY = 'mdreader_recent_vaults';

function loadRecentVaults() {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(VAULT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {string[]} vaults
 */
function saveRecentVaults(vaults) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vaults));
    } catch {}
  }
}

export const recentVaults = writable(loadRecentVaults());

/**
 * @param {string} vaultPath
 */
export function addToRecentVaults(vaultPath) {
  recentVaults.update(/** @param {string[]} vaults */ vaults => {
    const filtered = vaults.filter(/** @param {string} v */ v => v !== vaultPath);
    const updated = [vaultPath, ...filtered].slice(0, 10);
    saveRecentVaults(updated);
    return updated;
  });
}

export function clearRecentVaults() {
  recentVaults.set([]);
  saveRecentVaults([]);
}

export function clearAllRecents() {
  clearRecentFiles();
  clearRecentVaults();
}

/**
 * @param {string} filePath
 * @returns {string|null}
 */
function getFileName(filePath) {
  if (!filePath) return null;
  const parts = filePath.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  return name.replace(/\.(md|markdown)$/i, '');
}

// Derived stores
export const isLoading = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'loading');
export const isReady = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'ready');
export const isError = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'error');
