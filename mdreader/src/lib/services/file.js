import { invoke } from '@tauri-apps/api/core';

const EDITOR_KEY = 'mdreader_editor';

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
 * @returns {Promise<{path: string}>}
 */
export async function getFileInfo(filePath) {
  try {
    const path = await invoke('get_file_path', { path: filePath });
    return { path };
  } catch (/** @type {any} */ error) {
    console.error('Failed to get file info:', error);
    throw error;
  }
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function getFileName(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
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
 * @param {string} path
 * @returns {string}
 */
export function getParentDirectory(path) {
  const parts = path.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * @param {Window} _window
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function watchFile(_window, filePath) {
  try {
    await invoke('watch_file', { path: filePath });
  } catch (/** @type {any} */ error) {
    console.error('Failed to watch file:', error);
  }
}

/**
 * Open a file in an external editor.
 * Uses the user-configured editor from Settings, or system default if not configured.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function openInEditor(filePath) {
  const saved = localStorage.getItem(EDITOR_KEY) || '';
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
