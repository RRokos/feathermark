# SVG Rendering Notes

This branch contains a partial SVG rendering improvement for the Markdown reader.

## Current Result

- Markdown image references to local SVG files now render in the Tauri app.
- HTML image references such as `<img src="./images/example.svg">` now render when the path points to a local SVG file.
- Obsidian-style image embeds such as `![[images/example.svg]]` now render as image embeds.
- Image embed size metadata is supported for simple cases:
  - `![[images/example.svg|180]]`
  - `![[images/example.svg|180x90]]`
- Local image sources inside rendered Markdown are resolved relative to the Markdown file path instead of the WebView URL.
- Tauri's asset protocol is enabled for these local image resources.

## Remaining Issue

Inline SVG written directly inside a Markdown file still does not render correctly in the real app.

Example:

```md
<svg viewBox="0 0 120 40" width="120" height="40">
  <style>
    .label { fill: #2563eb; font-weight: 700; }
  </style>
  <text class="label" x="10" y="25">SVG</text>
</svg>
```

The sanitizer configuration was broadened to allow common SVG tags, SVG attributes, and SVG-local `<style>` content. A browser-level sanitizer test confirmed that SVG-local `<style>` can survive sanitization while unsafe style patterns are removed. However, the inline SVG still fails in the packaged/real Tauri app, so the remaining problem is likely in the Markdown-to-DOM rendering path, Svelte DOM insertion behavior, CSS/layout interaction, or a Tauri WebView-specific behavior. This is an observation, not a confirmed root cause.

## Security Expectations

Inline SVG support should remain conservative:

- Keep blocking scripts and event attributes such as `onload` and `onclick`.
- Keep blocking `<iframe>`, `<object>`, and `<embed>`.
- Keep blocking external CSS loads from `style` content, including `@import` and non-fragment `url(...)`.
- Fragment-only paint/style references such as `url(#gradient)` should remain allowed.
- Local file image resolution should remain limited to image file extensions.

## Verification Used

- `npm run check`
- `npm run build`
- `npm run tauri build`
- Packaged output was generated successfully:
  - `src-tauri/target/release/mdreader.exe`
  - `src-tauri/target/release/bundle/msi/Feathermark_0.1.5_x64_en-US.msi`
  - `src-tauri/target/release/bundle/nsis/Feathermark_0.1.5_x64-setup.exe`

## Useful Sample

`sample/with-svg.md` and `sample/images/styled-svg.svg` were added as a small manual test case for referenced and embedded SVG files.
