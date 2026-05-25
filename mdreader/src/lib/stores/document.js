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
      return stored ? JSON.parse(stored) : [];
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
  documentState.set(initialDocState);
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

export function clearRecentFiles() {
  recentFiles.set([]);
  saveRecentFiles([]);
}

/**
 * @param {string} filePath
 * @returns {string|null}
 */
function getFileName(filePath) {
  if (!filePath) return null;
  const parts = filePath.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  return name.replace(/\.md$/, '');
}

// Derived stores
export const isLoading = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'loading');
export const isReady = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'ready');
export const isError = derived(documentState, /** @param {any} $doc */ $doc => $doc.status === 'error');
