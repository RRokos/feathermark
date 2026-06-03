import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const EDITOR_KEY = 'mdreader_editor';
let windowCounter = 0;

/**
 * @param {string} filePath
 * @returns {Promise<{content: string, path: string}>}
 */
export async function openFile(filePath) {
  try {
    const result = await invoke('read_file', { path: filePath });
    return result;
  } catch (/** @type {any} */ error) {
    console.error('Failed to open file:', error);
    throw error;
  }
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function getDirectory(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * @param {string} path
 * @returns {Promise<Array<{name: string, path: string, is_dir: boolean}>>}
 */
export async function readDirectory(path) {
  try {
    const entries = await invoke('read_directory', { path });
    return entries;
  } catch (/** @type {any} */ error) {
    console.error('Failed to read directory:', error);
    throw error;
  }
}

/**
 * Get the parent directory of a path.
 * Alias for getDirectory — kept for backward compatibility.
 * @param {string} path
 * @returns {string}
 */
export const getParentDirectory = getDirectory;

/**
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function watchFile(filePath) {
  try {
    await invoke('watch_file', { path: filePath });
  } catch (/** @type {any} */ error) {
    console.error('Failed to watch file:', error);
    throw error;
  }
}

/**
 * Open a file in an external editor.
 * Uses the user-configured editor from Settings, or system default if not configured.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function openInEditor(filePath) {
  let saved = '';
  try { saved = localStorage.getItem(EDITOR_KEY) || ''; } catch {}
  try {
    await invoke('open_in_editor', { path: filePath, editor: saved });
  } catch (/** @type {any} */ error) {
    console.error('Failed to open in editor:', error);
    throw error;
  }
}

/**
 * Search for text across all markdown files in a directory
 * @param {string} root
 * @param {string} query
 * @returns {Promise<Array<{path: string, file_name: string, line_number: number, line_text: string}>>}
 */
export async function searchFiles(root, query) {
  try {
    return await invoke('search_files', { root, query });
  } catch (/** @type {any} */ error) {
    console.error('Failed to search files:', error);
    throw error;
  }
}

/**
 * Open a file in a new window using the JS WebviewWindow API
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function openInNewWindow(filePath) {
  const label = `file-${++windowCounter}-${Date.now()}`;
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || 'Untitled';

  // Store the file path in localStorage so the new window can read it on mount
  localStorage.setItem(`__feathermark_window_${label}`, filePath);

  const webview = new WebviewWindow(label, {
    title: `Feathermark — ${fileName}`,
    width: 1200,
    height: 800,
    center: true,
  });

  webview.once('tauri://error', (e) => {
    console.error('Failed to create new window:', e);
    localStorage.removeItem(`__feathermark_window_${label}`);
  });
}

/**
 * List all markdown files recursively in a directory
 * @param {string} root
 * @returns {Promise<Array<{name: string, path: string}>>}
 */
export async function listMarkdownFiles(root) {
  try {
    return await invoke('list_markdown_files', { root });
  } catch (/** @type {any} */ error) {
    console.error('Failed to list markdown files:', error);
    throw error;
  }
}
