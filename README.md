# Feathermark

> 羽墨 — A lightweight Markdown reader for Obsidian vaults

![Feathermark](logo.png)

**Feathermark** is a lightweight, fast, desktop Markdown reader built with **Tauri 2 + Svelte**. It renders Obsidian-flavored Markdown with full support for math formulas, Mermaid diagrams, callouts, wikilinks, and more — without the overhead of a full note-taking app.

[中文文档](README_CN.md)

## ✨ Features

- 📖 **Obsidian syntax support** — Callouts (28 types), `[[wikilinks]]`, `[[#Heading]]` self-links, `![[embeds]]`, footnotes, tags, task lists
- 📐 **KaTeX math** — Inline `$...$` and block `$$...$$` formulas
- 📊 **Mermaid diagrams** — Flowcharts, sequence diagrams, and 14+ diagram types (heuristic detection only on untagged code blocks)
- 🔍 **Full-text search** — Search across all files in a vault (Ctrl+Shift+F)
- 📝 **External editor** — Open files in VS Code, Notepad++, or any editor with one click
- 🗂️ **Optional tabs** — Browse multiple files in browser-style tabs
- 🪟 **Multi-window** — Double-click a `.md` file to open it in a new window; right-click to "Open in new window"
- 📁 **Show in folder** — Right-click a file in the sidebar to reveal it in Windows Explorer
- 🌙 **Dark mode** — Toggle with one click
- ⚡ **Lightweight** — Tauri 2 binary ~5MB, instant startup
- 🔗 **Vault-wide wikilink resolution** — Click `[[any page]]` and it finds the file anywhere in your vault (supports `.md` and `.markdown`)
- 🔎 **In-document search** — Ctrl+F to find text within the current document
- 🔒 **Secure** — DOMPurify HTML sanitization, KaTeX trust disabled, CSP enforced, invoke timeout protection

## 📦 Install

Download from [Releases](../../releases):

| File | Description |
|------|-------------|
| `Feathermark.exe` | Portable — run directly, no install needed |
| `Feathermark_x64-setup.exe` | Installer — supports double-click `.md` file association |

## 🛠️ Build from Source

**Prerequisites:** Node.js 18+, Rust 1.70+, Windows 10/11

```bash
git clone https://github.com/RRokos/feathermark.git
cd feathermark/mdreader
npm install
npm run tauri build
```

The output will be in `src-tauri/target/release/bundle/`.

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop framework | Tauri 2 |
| Frontend | Svelte (SvelteKit) |
| Markdown parser | markdown-it |
| Math rendering | KaTeX |
| Diagrams | Mermaid 11 |
| Code highlighting | highlight.js |
| HTML sanitization | DOMPurify |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Find in current document |
| Ctrl+Shift+F | Search across vault |
| Esc | Close find bar / settings |

## 📄 License

MIT
