# Feathermark · 羽墨

> 一个轻量级 Obsidian 风格 Markdown 阅读器

![Feathermark](logo.png)

**Feathermark** 是一个基于 **Tauri 2 + Svelte** 构建的桌面端 Markdown 阅读器。完整支持 Obsidian 常见语法（公式、Mermaid 图表、Callout、双链等），体积小、启动快，专注阅读体验。

不内置编辑功能——可一键跳转 VSCode / Notepad++ 等外部编辑器。

[English](README.md)

---

## 📦 下载安装

从 [Releases](../../releases) 页面下载：

| 文件 | 说明 |
|------|------|
| `Feathermark.exe` | 便携版，直接运行 |
| `Feathermark_x64-setup.exe` | 安装版，支持双击 .md 文件打开 |

---

## 📖 使用指南

### 基本操作

| 操作 | 方法 |
|------|------|
| 打开文件夹 | 点击 **📂** 按钮，或欢迎页的 **Open Folder** |
| 打开文件 | 在左侧目录树中点击 `.md` 文件 |
| 返回首页 | 点击标题栏 **←** 按钮 |
| 切换主题 | 点击 **🌙** / **☀️** 按钮 |

### 搜索

| 操作 | 方法 |
|------|------|
| 全文搜索 | 左侧搜索框输入关键词，或按 **Ctrl+Shift+F** |
| 文档内搜索 | 按 **Ctrl+F**，输入关键词，Enter 下一个 / Shift+Enter 上一个 |
| 清除搜索 | 点击 ✕ 或按 **Esc** |

### 外部编辑器

1. 点击 **⚙️** 打开设置
2. 在 **External Editor** 中选择编辑器（VSCode / Notepad++ / 自定义）
3. 自定义可点击 **Browse** 选择 .exe 文件
4. 保存后，点击 **✏️** 按钮或右键文件选择 "Open in editor"

### 标签页

1. 点击 **⚙️** → 勾选 **Enable tabs** → Save
2. 打开文件会出现标签栏
3. 点击标签切换，✕ 关闭标签
4. 关闭最后一个标签回到欢迎页

### Mermaid 图表

默认图表保持原始大小，超宽时页面可横向滚动。如需自适应宽度：

⚙️ → 勾选 **Fit diagram to text width** → Save

### 多窗口

- 双击 `.md` 文件会自动在新窗口打开（已有窗口不受影响）
- 在左侧目录树右键文件 → **Open in new window**

### 双链跳转

- 点击 `[[链接名]]` 自动跳转到对应文件
- 优先在同目录查找，找不到则在整个文件夹中按文件名匹配
- 找不到的链接会显示 "not found in vault" 提示

---

## ✨ 支持的语法

| 语法 | 示例 |
|------|------|
| 数学公式 | `$E=mc^2$` 和 `$$\int_0^1 x dx$$` |
| Mermaid 图表 | ` ```mermaid` 代码块 |
| Callout | `> [!note]`、`> [!warning]` 等 28 种类型 |
| 双链 | `[[页面名]]`、`[[页面\|别名]]`、`[[页面#标题]]` |
| 嵌入 | `![[图片.png]]`、`![[笔记.md]]` |
| 脚注 | `[^1]` 引用 + `[^1]: 定义` |
| 标签 | `#tag`、`#nested/tag` |
| 任务列表 | `- [x] 已完成`、`- [ ] 待完成` |
| Frontmatter | YAML 元数据，显示在文档顶部 |
| 代码高亮 | ` ```python` 等带语言标记的代码块 |

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+F | 文档内搜索 |
| Ctrl+Shift+F | 全文搜索（聚焦左侧搜索框） |
| Esc | 关闭搜索条 / 设置窗口 |

---

## 🛠️ 从源码构建

需要：Node.js 18+、Rust 1.70+、Windows 10/11

```bash
git clone https://github.com/RRokos/feathermark.git
cd feathermark/mdreader
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 打包
```

打包产物在 `src-tauri/target/release/bundle/` 下。

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | Svelte (SvelteKit) |
| Markdown 解析 | markdown-it |
| 公式渲染 | KaTeX |
| 图表渲染 | Mermaid 11 |
| 代码高亮 | highlight.js |
| HTML 消毒 | DOMPurify |

## 📄 许可证

MIT
