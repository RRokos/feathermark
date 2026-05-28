# Feathermark

Feathermark is a lightweight desktop Markdown reader built with `Tauri 2 + Svelte`.
It is focused on fast reading of Obsidian-style notes, not note editing.

## Features

- Obsidian-flavored Markdown rendering
- Wikilinks: `[[Page]]`, `[[Page|Alias]]`, `[[Page#Heading]]`, `[[#Heading]]`
- Embeds: `![[note]]`, `![[note.md]]`, `![[image.png]]`
- Local image resolution for both normal Markdown images and Obsidian image embeds
- Vault-aware note and asset lookup, including auto-detection of the nearest `.obsidian` root
- KaTeX math rendering for inline and block formulas
- Mermaid diagram rendering
- Callouts, footnotes, tags, task lists, tables, code highlighting
- Vault-wide search
- External editor integration
- Optional browser-style tabs
- Multi-window open
- Show file in Explorer

## Vault Behavior

When you open a file directly, Feathermark now attempts to detect the nearest vault root automatically:

- If an ancestor directory contains `.obsidian`, that directory is treated as the vault root
- Otherwise, the file's parent directory is used as the fallback root

This is used for:

- vault-wide wikilink resolution
- embed resolution
- local asset and image resolution

If you manually choose a folder from the UI, that folder becomes the active vault root for the current window.

## Supported Syntax

- Math: `$...$`, `$$...$$`
- Mermaid fenced blocks: ```` ```mermaid ````
- Callouts: `> [!note]`, `> [!warning]`, `> [!tip]`, etc.
- Wikilinks and heading links
- Embeds for notes and images
- Footnotes
- Tags
- Task lists
- Frontmatter display

## Keyboard Shortcuts

- `Ctrl+F`: find in current document
- `Ctrl+Shift+F`: focus vault search
- `Esc`: close find bar or modal

## Build

Requirements:

- Node.js 18+
- Rust 1.70+
- Windows 10/11

```bash
npm install
npm run check
npm run build
npm run tauri build
```

Before running `npm run tauri build`, close any running `Feathermark` / `mdreader` process.
The build script now checks for a running instance and stops early with a clear error message instead of failing later on a locked executable.

## Output

Tauri bundles are produced under:

```text
src-tauri/target/release/bundle/
```

## Notes

- The app is a reader, not an editor
- External editor launch is configurable in Settings
- Mermaid diagrams can keep original width or fit the text column

## License

MIT
