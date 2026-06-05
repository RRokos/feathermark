# SVG Rendering Notes

This branch contains SVG rendering improvements for the Markdown reader and a
small dark-mode sidebar control fix.

## Current Result

- Markdown image references to local SVG files now render in the Tauri app.
- HTML image references such as `<img src="./images/example.svg">` now render when the path points to a local SVG file.
- Obsidian-style image embeds such as `![[images/example.svg]]` now render as image embeds.
- Image embed size metadata is supported for simple cases:
  - `![[images/example.svg|180]]`
  - `![[images/example.svg|180x90]]`
- Local image sources inside rendered Markdown are resolved relative to the Markdown file path instead of the WebView URL.
- Tauri's asset protocol is enabled for these local image resources.
- Inline SVG written directly in Markdown now avoids tag preprocessing inside
  `<svg>` and `<style>` blocks, so color values such as `#2563eb` are not
  rewritten as Markdown tags.
- The repository browser toolbar controls remain visible in dark mode.

## Inline SVG Example

Inline SVG with local styles is expected to render:

```md
<svg viewBox="0 0 120 40" width="120" height="40">
  <style>
    .label { fill: #2563eb; font-weight: 700; }
  </style>
  <text class="label" x="10" y="25">SVG</text>
</svg>
```

The sanitizer configuration allows common SVG tags, SVG attributes, and
SVG-local `<style>` content. Tag preprocessing now skips SVG/style blocks so
hex colors inside SVG CSS are preserved.

## Security Expectations

Inline SVG support should remain conservative:

- Keep blocking scripts and event attributes such as `onload` and `onclick`.
- Keep blocking `<iframe>`, `<object>`, and `<embed>`.
- Keep blocking external CSS loads from `style` content, including `@import` and non-fragment `url(...)`.
- Fragment-only paint/style references such as `url(#gradient)` should remain allowed.
- Local file image resolution should remain limited to image file extensions.

## Verification Used

- Targeted Markdown rendering check:
  - Inline SVG CSS hex colors are not rewritten as `<span class="tag">...`.
  - Normal prose tags such as `hello #tag` still render as Markdown tags.
- `npm run check`
- `npm run build`
- Earlier in this branch, `npm run tauri build` generated packaged output successfully:
  - `src-tauri/target/release/mdreader.exe`
  - `src-tauri/target/release/bundle/msi/Feathermark_0.1.5_x64_en-US.msi`
  - `src-tauri/target/release/bundle/nsis/Feathermark_0.1.5_x64-setup.exe`

## Useful Sample

`sample/with-svg.md` and `sample/images/styled-svg.svg` were added as a small manual test case for referenced and embedded SVG files.
