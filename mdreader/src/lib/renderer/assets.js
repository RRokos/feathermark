import { convertFileSrc, isTauri } from '@tauri-apps/api/core';

const IMAGE_EXT = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:$|[?#])/i;
const SKIP_PROTOCOL = /^(?:https?:|data:|blob:|asset:|tauri:|about:|mailto:|tel:)/i;
const FILE_PROTOCOL = /^file:\/\//i;
const WINDOWS_ABSOLUTE = /^[a-zA-Z]:[\\/]/;

/**
 * @param {string} filePath
 * @returns {string}
 */
function getDirectory(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

/**
 * @param {string} value
 * @returns {string}
 */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * @param {string} value
 * @returns {{ path: string; suffix: string }}
 */
function splitPathSuffix(value) {
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const suffixIndex = indexes.length > 0 ? Math.min(...indexes) : -1;

  if (suffixIndex < 0) {
    return { path: value, suffix: '' };
  }

  return {
    path: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex)
  };
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function hasNonFileProtocol(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) && !WINDOWS_ABSOLUTE.test(value) && !FILE_PROTOCOL.test(value);
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePath(value) {
  let path = value.replace(/\\/g, '/');
  let prefix = '';

  if (/^[a-zA-Z]:\//.test(path)) {
    prefix = path.slice(0, 3);
    path = path.slice(3);
  } else if (path.startsWith('//')) {
    prefix = '//';
    path = path.slice(2);
  } else if (path.startsWith('/')) {
    prefix = '/';
    path = path.slice(1);
  }

  /** @type {string[]} */
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') {
        parts.pop();
      } else if (!prefix) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }

  return prefix + parts.join('/');
}

/**
 * @param {string} value
 * @returns {string|null}
 */
function fileUrlToPath(value) {
  try {
    const url = new URL(value);
    let path = safeDecode(url.pathname);
    if (url.hostname) {
      path = `//${url.hostname}${path}`;
    }
    if (/^\/[a-zA-Z]:\//.test(path)) {
      path = path.slice(1);
    }
    return normalizePath(path);
  } catch {
    return null;
  }
}

/**
 * @param {string} rawPath
 * @param {string} baseDir
 * @param {string} vaultRoot
 * @returns {string|null}
 */
function resolveLocalPath(rawPath, baseDir, vaultRoot) {
  const decodedPath = safeDecode(rawPath);

  if (FILE_PROTOCOL.test(decodedPath)) {
    return fileUrlToPath(decodedPath);
  }

  if (hasNonFileProtocol(decodedPath)) {
    return null;
  }

  if (WINDOWS_ABSOLUTE.test(decodedPath) || decodedPath.startsWith('\\\\') || decodedPath.startsWith('//')) {
    return normalizePath(decodedPath);
  }

  if (decodedPath.startsWith('/') && vaultRoot) {
    return normalizePath(`${vaultRoot}/${decodedPath.slice(1)}`);
  }

  if (decodedPath.startsWith('/')) {
    return normalizePath(decodedPath);
  }

  if (!baseDir) {
    return null;
  }

  return normalizePath(`${baseDir}/${decodedPath}`);
}

/**
 * @param {string} src
 * @param {string} baseDir
 * @param {string} vaultRoot
 * @returns {string|null}
 */
export function resolveLocalImageSource(src, baseDir, vaultRoot = '') {
  if (!src || SKIP_PROTOCOL.test(src)) return null;

  const { path, suffix } = splitPathSuffix(src.trim());
  if (!IMAGE_EXT.test(path)) return null;

  const localPath = resolveLocalPath(path, baseDir, vaultRoot);
  if (!localPath) return null;
  if (!isTauri()) return null;

  return `${convertFileSrc(localPath)}${suffix}`;
}

/**
 * Resolve image sources that should be relative to the Markdown file instead
 * of the app's WebView URL.
 * @param {HTMLElement} container
 * @param {string} currentFilePath
 * @param {string} [vaultRoot]
 * @returns {void}
 */
export function processLocalImageSources(container, currentFilePath, vaultRoot = '') {
  if (!container || !isTauri()) return;

  const baseDir = currentFilePath ? getDirectory(currentFilePath) : '';

  container.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const resolved = resolveLocalImageSource(src, baseDir, vaultRoot);
    if (resolved) img.setAttribute('src', resolved);
  });

  container.querySelectorAll('svg image').forEach((image) => {
    for (const attr of ['href', 'xlink:href']) {
      const src = image.getAttribute(attr) || '';
      const resolved = resolveLocalImageSource(src, baseDir, vaultRoot);
      if (resolved) image.setAttribute(attr, resolved);
    }
  });
}
