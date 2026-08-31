# Feathermark

> 羽墨 — A lightweight Markdown reader for Obsidian vaults

![Feathermark](logo.png)

**Feathermark** is a lightweight, fast, desktop Markdown reader built with **Tauri 2 + Svelte**. It renders Obsidian-flavored Markdown with full support for math formulas, Mermaid diagrams, callouts, wikilinks, and more — without the overhead of a full note-taking app.

[中文文档](README_CN.md)

## ✨ Features

- 📖 **Obsidian syntax support** — Callouts (28 types), `[[wikilinks]]`, `[[#Heading]]` self-links, `![[embeds]]`, footnotes, tags, task lists
- 📐 **KaTeX math** — Inline `$...$` and block `$$...$$` formulas
- 📊 **Mermaid diagrams** — Flowcharts, sequence diagrams, and 14+ diagram types (heuristic detection only on untagged code blocks)
- 🖼️ **SVG rendering** — Optional inline SVG support with security toggle (default off)
- 🔍 **Full-text search** — Search across all files in a vault (Ctrl+Shift+F)
- 📝 **External editor** — Open files in Notepad (default), VS Code, Notepad++, or any editor with one click
- 🗂️ **Optional tabs** — Browse multiple files in browser-style tabs
- 🪟 **Multi-window** — Double-click a `.md` file to open it in a new window; right-click to "Open in new window"
- 📁 **Show in folder** — Right-click a file in the sidebar to reveal it in Windows Explorer
- 🌙 **Dark mode** — Toggle with one click (top toolbar and sidebar controls remain visible)
- 🎨 **Custom accent color** — 12 presets + custom color picker
- 🔎 **Interface zoom** — Ctrl/Cmd + `+`/`-`/`0` or mouse wheel to scale UI (85%–115%)
- ⚡ **Lightweight** — Tauri 2 binary ~5MB, instant startup
- 🔗 **Vault-wide wikilink resolution** — Click `[[any page]]` and it finds the file anywhere in your vault (supports `.md` and `.markdown`)
- 🔎 **In-document search** — Ctrl+F to find text within the current document
- 🔒 **Secure** — DOMPurify HTML sanitization, SVG security toggle, CSP enforced, 45+ event handler blocklist
- 🧪 **Tested** — 67 Vitest unit tests + GitHub Actions CI on every push

## 📦 Install

Download from [Releases](../../releases):

| File | Description |
|------|-------------|
| `Feathermark_0.1.6_x64-setup.exe` | NSIS installer — supports double-click `.md` file association |
| `Feathermark_0.1.6_x64_en-US.msi` | MSI installer for managed deployments |
| `Feathermark.exe` | Portable — run directly, no install needed |

## ✨ Supported syntax

| Syntax | Example |
|--------|---------|
| Math | `$E=mc^2$` and `$$\int_0^1 x\,dx$$` |
| Mermaid | ```` ```mermaid ```` fenced blocks (heuristic detection also works for untagged code blocks) |
| Callouts | `> [!note]`, `> [!warning]`, etc. — 28 types, with nesting and custom titles |
| Wikilinks | `[[Page]]`, `[[Page\|Alias]]`, `[[Page#Heading]]`, `[[#Heading]]` |
| Embeds | `![[image.png]]`, `![[note.md]]`, `![[image.png\|200x100]]` (size), `![[image.png\|Alt text]]` (alt text) |
| Footnotes | `[^1]` reference (clickable) + `[^1]: definition` |
| Tags | `#tag`, `#nested/tag` (skipped inside inline code and inside SVG/style blocks) |
| Task lists | `- [x] done`, `- [ ] todo` |
| Frontmatter | YAML metadata displayed at the top of the document, CRLF-tolerant |
| Fences | Tilde (`~~~sql`) and multi-backtick (5+ backticks wrapping 3-backtick content) |

## 📖 Settings

- **External editor** — Default is Notepad; pick VS Code, Notepad++, or any `.exe`.
- **Tabs** — Enable browser-style tabs across the top.
- **Mermaid fit** — Fit diagrams to text width or keep original size with horizontal scroll.
- **SVG rendering** — When off, the sanitizer strips all SVG tags from rendered output. Default: off.
- **UI scale** — 85% – 115% in 5% steps (same range as the Ctrl/Cmd +/-/0 shortcuts).
- **Accent color** — 12 presets or pick a custom color.
- **Theme** — Light or dark.
- **Reset Defaults** — Clears every Feathermark setting. Recent files and vaults are intentionally preserved.

The settings modal is scrollable so every option stays reachable on smaller viewports.

## 🛠️ Build from Source

**Prerequisites:** Node.js 18+, Rust 1.70+, Windows 10/11

```bash
git clone https://github.com/RRokos/feathermark.git
cd feathermark/mdreader
npm install
npm run tauri build
```

The output will be in `src-tauri/target/release/bundle/`.

For development:

```bash
npm run tauri dev      # dev mode with hot reload
```

Run the test suite locally:

```bash
npm test           # vitest (67 tests)
npm run check      # svelte-check (type checking)
npm run build      # frontend production build
```

The same three commands run on every push via GitHub Actions (`.github/workflows/ci.yml`).

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop framework | Tauri 2 |
| Frontend | Svelte (SvelteKit) |
| Markdown parser | markdown-it + markdown-it-task-lists |
| Math rendering | KaTeX |
| Diagrams | Mermaid 11 |
| Code highlighting | highlight.js |
| HTML sanitization | DOMPurify |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Find in current document |
| Ctrl+Shift+F | Search across vault |
| Ctrl+`+`/`-`/`0` | Zoom in / out / reset |
| Ctrl+Mouse Wheel | Zoom in/out |
| Esc | Close find bar / settings |

## 📄 License

MIT
