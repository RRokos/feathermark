# Changelog

## v0.1.3 (2026-05-28)

### Critical Fix: Multi-window IPC Deadlock

`WebviewWindowBuilder::build()` was called directly inside IPC command handlers and the single-instance callback. This function posts window creation to the main thread and blocks waiting for completion — deadlocking the entire Tauri event loop when called from a non-main thread.

**Fix:** Both `open_in_new_window` and the single-instance callback now use `thread::spawn` for window creation.

### Security Fixes

- **XSS: embed path injection** — Error messages use `textContent` instead of `innerHTML` (`embed.js`)
- **XSS: KaTeX trust:true** — Disabled `trust: true` to block `\href{javascript:...}` vectors (`katex.js`)
- **Capabilities: removed opener:allow-open-url** — Unnecessary attack surface (`capabilities/default.json`)

### Stability Fixes

- **Invoke timeout** — All IPC calls wrapped with 10-second timeout via `invokeWithTimeout()` (`file.js`)
- **Per-window file watcher** — `HashMap<String, Arc<AtomicBool>>` replaces single shared signal; watcher threads cleaned up on window close (`lib.rs`)
- **Mutex poisoning recovery** — `lock()` helper recovers from poisoning instead of panicking (`lib.rs`)
- **Symlink cycle protection** — `collect_markdown_files` limited to 20 recursion depth (`lib.rs`)
- **Case-insensitive extensions** — `.MD`, `.Markdown` files now recognized (`lib.rs`)
- **loadFile generation tracking** — Prevents stale async results from overwriting newer loads (`App.svelte`)
- **afterUpdate DOM guard** — Only overwrites DOM when `renderedHtml` changes; mermaid re-renders on theme toggle (`MarkdownView.svelte`)
- **renderGeneration counter** — Async mermaid/embed operations check generation before mutating DOM (`MarkdownView.svelte`)

### Correctness Fixes

- **Footnote refs clickable** — Wrapped in `<a href="#footnote-{id}">` (`markdown.js`)
- **`[[#Heading]]` self-links** — Empty pageName produces anchor-only link (`markdown.js`)
- **Frontmatter \r\n** — Regex handles Windows-style line endings (`markdown.js`)
- **Tags in inline code** — `#word` inside backticks no longer converted to tags (`markdown.js`)
- **Mermaid heuristic safety** — Only applies to code blocks without explicit language specifier (`mermaid.js`)
- **embed mermaid dark theme** — `processEmbeds` passes `isDark` to `processMermaidBlocks` (`embed.js`)
- **Refresh button in tabs mode** — Uses `$activeTab.filePath` when tabs enabled (`App.svelte`)
- **file-changed in tabs mode** — Checks `$activeTab.filePath` for external modification (`App.svelte`)
- **tabs error handling** — Load failure resets to idle instead of stuck loading spinner (`App.svelte`)
- **resolveWikilink .markdown** — Tries both `.md` and `.markdown` extensions (`App.svelte`)
- **Event listener cleanup** — Promise-based cleanup for async listener registration (`App.svelte`)
- **KaTeX macros** — Added `\arccot`, `\arcsec`, `\arccsc` → `\operatorname{...}` (`katex.js`)

### New Features

- **show_in_folder** — New Rust command + right-click context menu option to reveal file in Windows Explorer
- **Context menu** — Four options: Open, Open in new window, Show in folder, Open in editor
- **.markdown extension** — Full support alongside `.md` in sidebar, search, wikilinks

### Configuration

- **app.html** — Title changed from "Tauri + SvelteKit App" to "Feathermark"
- **CSP** — Added `font-src 'self' data:` directive
- **bundle.targets** — Changed from `"all"` to `["msi", "nsis"]`

### Version Bump

- `package.json`: 0.1.2 → 0.1.3
- `Cargo.toml`: 0.1.2 → 0.1.3
- `tauri.conf.json`: 0.1.2 → 0.1.3

---

## v0.1.2 (2026-05-27)

### Multi-window Support

- Double-click `.md` files to open in new windows via file association + single-instance plugin
- Right-click context menu "Open in new window" option
- `WebviewWindowBuilder` for creating dynamic windows with `/?file={encoded}` URL pattern
- Capabilities glob `"file-*"` covers dynamically created windows

### LaTeX Fix

- Added `KATEX_MACROS` for `\arccot`, `\arcsec`, `\arccsc` → `\operatorname{...}` conversions

### Show in Folder

- New `show_in_folder` Rust command using `explorer /select,` with `raw_arg` for proper path quoting

### Cleanup

- Removed `loadSample` / `loadSampleVault` functions
- Removed `get_app_dir` Rust command
- Removed sample file auto-loading on startup
