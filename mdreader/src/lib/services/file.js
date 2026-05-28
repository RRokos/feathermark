import { invoke } from '@tauri-apps/api/core';

const EDITOR_KEY = 'mdreader_editor';
const INVOKE_TIMEOUT_MS = 10000;

/**
 * Wrap invoke() with a timeout to prevent indefinite hangs.
 * @param {string} cmd
 * @param {Record<string, any>} [args]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
function invokeWithTimeout(cmd, args = {}, timeoutMs = INVOKE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IPC timeout: ${cmd} did not respond within ${timeoutMs}ms`));
    }, timeoutMs);

    invoke(cmd, args).then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * @param {string} filePath
 * @returns {Promise<{content: string, path: string}>}
 */
export async function openFile(filePath) {
  return await invokeWithTimeout('read_file', { path: filePath });
}

/**
 * @param {string} filePath
 * @returns {Promise<{path: string}>}
 */
export async function getFileInfo(filePath) {
  const path = await invokeWithTimeout('get_file_path', { path: filePath });
  return { path };
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
  return await invokeWithTimeout('read_directory', { path });
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
    await invokeWithTimeout('watch_file', { path: filePath });
  } catch (/** @type {any} */ error) {
    console.warn('Failed to watch file:', error);
  }
}

/**
 * Open a file in an external editor.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function openInEditor(filePath) {
  const saved = localStorage.getItem(EDITOR_KEY) || '';
  await invokeWithTimeout('open_in_editor', { path: filePath, editor: saved });
}

/**
 * Search for text across all markdown files in a directory
 * @param {string} root
 * @param {string} query
 * @returns {Promise<Array<{path: string, file_name: string, line_number: number, line_text: string}>>}
 */
export async function searchFiles(root, query) {
  return await invokeWithTimeout('search_files', { root, query });
}

/**
 * Open a file in a new window
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function openInNewWindow(filePath) {
  await invokeWithTimeout('open_in_new_window', { filePath });
}

/**
 * Show a file in the system file explorer (Windows Explorer)
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function showInFolder(filePath) {
  await invokeWithTimeout('show_in_folder', { path: filePath });
}

/**
 * List all markdown files recursively in a directory
 * @param {string} root
 * @returns {Promise<Array<{name: string, path: string}>>}
 */
export async function listMarkdownFiles(root) {
  return await invokeWithTimeout('list_markdown_files', { root });
}
