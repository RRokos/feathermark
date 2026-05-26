---
title: Obsidian Sample Note
tags: [test, sample, obsidian]
aliases: [Obsidian Sample, Test Note]
created: 2024-01-15
---

# Obsidian Syntax Sample

## Frontmatter

The YAML frontmatter above contains title, tags, aliases, and creation date.

## Wikilinks

### Basic Wikilink
[[Another Page]]

### Wikilink with Alias
[[Another Page|Display Text]]

### Wikilink with Heading
[[Another Page#Section Name]]

### Wikilink with Alias and Heading
[[Another Page#Section|Link Text]]

## Embeds

### Image Embed
![[example-image.png]]

### Markdown Embed
![[some-note]]

## Callout

> [!note]
> This is a note callout. It contains important information.

> [!warning]
> This is a warning callout.

> [!tip]
> This is a tip callout with helpful advice.

> [!example]
> This is an example callout.

> [!quote]
> This is a quote callout that can contain referenced content.

## Footnotes

Here is a reference to a footnote[^1].

And another reference to a different footnote[^note].

[^1]: This is the first footnote. It provides additional context.
[^note]: This is the second footnote with more information.

## Tags

#tag1 #tag2 #nested/tag #multi/word/tag

## Task List with Metadata

- [x] Completed task with checkbox
- [ ] Incomplete task
- [>] Task in progress
- [/] Task being worked on

## Horizontal Rule

---

## Code Block with Syntax

```python
def hello_world():
    print("Hello, World!")

# Comment in code
def calculate(a: int, b: int) -> int:
    return a + b
```

## Table with Alignment

| Left | Center | Right |
|:-----|:------:|------:|
| Cell 1 | Cell 2 | Cell 3 |
| Cell 4 | Cell 5 | Cell 6 |