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
| `Feathermark_0.1.6_x64-setup.exe` | NSIS 安装版，支持双击 .md 文件打开 |
| `Feathermark_0.1.6_x64_en-US.msi` | MSI 安装版，适合企业部署 |

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

### SVG 渲染

本地 SVG 图片在 Markdown、`<img>` 标签、Obsidian `![[file.svg]]` 嵌入中均可渲染。出于安全考虑，**默认关闭**。

⚙️ → 勾选 **Enable SVG rendering** → Save。

关闭时，DOMPurify 会剥离渲染输出中的全部 SVG 标签。Markdown 中内联的 `<svg>` 块会作为代码显示源码。

### 全应用缩放

| 操作 | 快捷键 |
|------|--------|
| 放大 | **Ctrl/Cmd + `+`** |
| 缩小 | **Ctrl/Cmd + `-`** |
| 重置 100% | **Ctrl/Cmd + `0`** |
| 鼠标调整 | **Ctrl/Cmd + 滚轮** |

范围 **85% – 115%**，步长 5%。设置按窗口独立保存，也可在 **Settings** 中用滑块调节。

### 多窗口

- 双击 `.md` 文件会自动在新窗口打开（已有窗口不受影响）
- 在左侧目录树右键文件 → **Open in new window**
- 右键文件 → **Show in folder** 可在资源管理器中定位该文件
- 每个窗口独立文件监听，关闭窗口自动清理资源

### 双链跳转

- 点击 `[[链接名]]` 自动跳转到对应文件
- 优先在同目录查找，找不到则在整个文件夹中按文件名匹配
- 找不到的链接会显示 "not found in vault" 提示

---

## ✨ 支持的语法

| 语法 | 示例 |
|------|------|
| 数学公式 | `$E=mc^2$` 和 `$$\int_0^1 x dx$$` |
| Mermaid 图表 | ` ```mermaid` 代码块（仅无语言标识时启发式检测） |
| Callout | `> [!note]`、`> [!warning]` 等 28 种类型，支持嵌套和自定义标题 |
| 双链 | `[[页面名]]`、`[[页面\|别名]]`、`[[页面#标题]]`、`[[#当前文档标题]]` |
| 嵌入 | `![[图片.png]]`、`![[笔记.md]]`、`![[图片.png\|200x100]]`（尺寸）、`![[图片.png\|替代文本]]` |
| 脚注 | `[^1]` 引用（可点击跳转）+ `[^1]: 定义` |
| 标签 | `#tag`、`#nested/tag`（行内代码和 SVG/style 块内不处理） |
| 任务列表 | `- [x] 已完成`、`- [ ] 待完成` |
| Frontmatter | YAML 元数据，显示在文档顶部（兼容 Windows 换行符） |
| 代码高亮 | ` ```python` 等带语言标记的代码块 |
| 代码块 fence | 支持 tilde (`~~~sql`) 和多反引号（5+ 反引号包裹 3 反引号内容） |

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+F | 文档内搜索 |
| Ctrl+Shift+F | 全文搜索（聚焦左侧搜索框） |
| Ctrl/Cmd + `+` / `-` / `0` | 放大 / 缩小 / 重置缩放 |
| Ctrl/Cmd + 滚轮 | 鼠标滚轮缩放 |
| Esc | 关闭搜索条 / 设置窗口 |

### ⚙️ 设置面板

- **External editor** — 默认 Notepad，可换 VS Code、Notepad++ 或任意 `.exe`
- **Tabs** — 开启后顶部显示浏览器风格标签栏
- **Mermaid fit** — 图表自适应文字宽度 / 保持原始大小横向滚动
- **SVG rendering** — 关闭时 DOMPurify 剥离 SVG 标签，默认关闭
- **UI scale** — 85% – 115%，步长 5%（与 Ctrl/Cmd +/-/0 快捷键同范围）
- **Accent color** — 12 个预设或自定义取色
- **Theme** — 亮色 / 暗色
- **Reset Defaults** — 清空所有 Feathermark 设置（最近文件和 vault 故意保留）

设置面板内容区可滚动，矮视口下也能访问全部选项。

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

开发模式：

```bash
npm run tauri dev      # 开发模式（热重载）
```

运行测试：

```bash
npm test           # vitest（67 个测试）
npm run check      # svelte-check（类型检查）
npm run build      # 前端生产构建
```

以上三个命令在每次 push 时由 GitHub Actions 自动运行（`.github/workflows/ci.yml`）。

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | Svelte (SvelteKit) |
| Markdown 解析 | markdown-it + markdown-it-task-lists |
| 公式渲染 | KaTeX |
| 图表渲染 | Mermaid 11 |
| 代码高亮 | highlight.js |
| HTML 消毒 | DOMPurify |

## 📄 许可证

MIT
