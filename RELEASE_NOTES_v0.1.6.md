# Feathermark v0.1.6 — Release Notes

**Release date:** 2026-07-14

Feathermark v0.1.6 focuses on rendering quality, security hardening, and developer
infrastructure. The headline changes are SVG rendering with an opt-in toggle,
fixes to fence detection that bring the parser in line with CommonMark/GFM,
and the introduction of a Vitest test suite plus GitHub Actions CI.

---

## ✨ Highlights

### SVG rendering (opt-in)

Markdown images, HTML `<img>` tags, and Obsidian embeds (`![[file.svg]]`) now
render local SVG resources. SVG rendering is **off by default** for safety —
toggle it on in **Settings → SVG rendering**. When disabled, the sanitizer
strips all SVG tags from rendered output.

This release also adds DOMPurify hardening to keep SVG support safe:

- `<foreignObject>` removed from the whitelist (it can embed arbitrary HTML
  forms and was a phishing vector).
- `FORBID_ATTR` expanded from 9 event handlers to **45**, covering `onpointer*`,
  `ontouch*`, `onanimation*`, `ontransition*`, and clipboard handlers
  (`oncopy`, `oncut`, `onpaste`).

### CommonMark / GFM fence detection

All six preprocessors used a naive `startsWith(' ``` ')` check that broke on:

- Tilde fences (`~~~sql`)
- Multi-backtick fences (5+ backticks wrapping a 3-backtick block)
- 4-space-indented fences (which should be treated as indented code, not a fence)

A new `detectFence()` function replaces all six call sites and follows the
CommonMark/GFM spec:

- Opening fence: 0–3 space indent, 3+ backticks or tildes, optional info string
- Closing fence: same character, length ≥ opener, no info string
- CRLF line endings are normalized before splitting, so Windows files render
  correctly

### App-wide zoom

Press **Ctrl/Cmd + `+` / `-` / `0`** or hold **Ctrl/Cmd + scroll** to scale the
UI from 85% to 115% in 5% steps. The setting persists per window and the
slider in **Settings** lets you adjust it visually. `Tauri's
setWebviewZoom` is used so text, icons, controls, and images scale together.

### Settings UX

- The settings modal body is now scrollable (`max-height: calc(100vh - 180px)`),
  so all options stay reachable on smaller viewports.
- A **Reset Defaults** button clears every Feathermark setting in localStorage
  (theme, accent color, UI scale, SVG toggle, editor path, tabs, Mermaid fit).
  Recent files and vaults are intentionally preserved.
- Default external editor changed from VS Code to **Notepad**, so the app is
  usable immediately after install without configuring a third-party editor.

### Vitest + GitHub Actions CI

- 67 unit tests covering fence detection, code-block isolation, CRLF
  handling, inline-code protection, and PR #2 regression coverage.
- GitHub Actions workflow runs `npm test`, `npm run check`, and
  `npm run build` on every push and PR. Windows builds are still produced
  locally and uploaded manually.

---

## 🐛 Bug fixes

- `preprocessTags` no longer mis-classifies `#tag` patterns that appear inside
  inline code. ` ``<svg>`` `#tag`` ` now renders the tag as-is instead of
  activating the raw-tag skip path.
- `preprocessTags` propagates the per-part raw-tag state to the line level so
  a `<svg>...</svg>` block that opens on one line and closes on the next is
  still skipped.
- All six preprocessors (`Callouts`, `Embeds`, `Wikilinks`, `Footnotes`, `Tags`,
  and `parseFrontmatter`) now normalize `\r` so Windows CRLF files render
  correctly. Previously the regex `(.*)$` failed because `.` does not match
  `\r`.
- `smoke-test.md` section 2f had an invalid closing fence (3 backticks inside
  a 3-backtick wrapper with internal spaces). Replaced with a 5-backtick
  outer / 3-backtick inner pair per CommonMark.
- Dark-mode toolbar buttons (top "Back to home" arrow and Sidebar
  up/back/forward arrows) were invisible. Scoped dark-mode overrides through
  the sidebar container.
- `![[image.png|200x100]]` now supports width×height metadata.
- `![[image.png|Alt text]]` now supports an alt-text alternative.
- SVG embeds are rendered as `<img>` rather than recursively parsed as
  Markdown (which would have re-triggered tag preprocessing).

---

## 🔒 Security hardening

- `<foreignObject>` removed from DOMPurify `ADD_TAGS` (XSS via embedded HTML
  forms).
- `FORBID_ATTR` extended to 45 event handlers (`onpointer*`, `ontouch*`,
  `onanimation*`, `ontransition*`, `oncopy`, `oncut`, `onpaste`).
- Inline-code protection in `preprocessTags` ensures `` `<svg>` #tag `` no
  longer activates the raw-tag skip path (which would have suppressed all
  tag processing on the line).
- A comment in `sanitize.js` documents the CSP dependency that makes
  `href`/`xlink:href` safe inside SVG.

---

## 📦 Downloads

| File | Description |
|------|-------------|
| `Feathermark_0.1.6_x64-setup.exe` | NSIS installer, recommended for most users |
| `Feathermark_0.1.6_x64_en-US.msi` | MSI installer for managed deployments |
| `Feathermark_0.1.6.exe` | Portable executable (extract anywhere) |

System requirements: Windows 10/11, WebView2 Runtime (preinstalled on
Windows 11; Windows 10 users may need to install it from Microsoft).

---

## 🛠 Build from source

```bash
git clone https://github.com/RRokos/feathermark.git
cd feathermark/mdreader
npm install
npm run tauri build
```

Bundles are produced under `src-tauri/target/release/bundle/`.

---

## 📝 Known limitations

- Nested callouts (`> > [!type]`) render as blockquotes, not as inner
  callout divs.
- Frontmatter parser is single-line `key: value` only.
- Sidebar search does not highlight match positions.
- `localStorage` does not sync across windows (theme/accent remain per-window).

---

## 🙏 Credits

This release includes merged contributions from the
`TrisWty57/feathermark-contribution` branch (PR #1 and PR #2):
controlled app-zoom support, inline SVG rendering, and dark-mode sidebar
control fixes.

## License

MIT