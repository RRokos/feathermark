# Feathermark — 轻量 Markdown 阅读器

> 中文名：羽墨（待定）

双击 `.md` 文件即可打开查看，支持 Obsidian 常见语法。也可打开文件夹浏览多个文件。  
定位类似 VSCode 的 Markdown 预览体验——轻量、快速、不做多余的事。  
不内置编辑功能，可右键/按钮用外部编辑器（VSCode、Notepad++ 等）打开编辑。

## 技术栈

- **桌面框架**: Tauri 2
- **前端**: Svelte (SvelteKit)
- **Markdown 解析**: markdown-it + markdown-it-task-lists
- **公式渲染**: KaTeX
- **图表渲染**: Mermaid 11
- **代码高亮**: highlight.js
- **HTML 消毒**: DOMPurify

## 项目结构

```
mdreader/
├── src/lib/
│   ├── components/
│   │   ├── App.svelte          # 根组件（欢迎页、路由、文件加载、快捷键）
│   │   ├── MarkdownView.svelte # 内容渲染（DOMPurify + KaTeX + Mermaid + embed）
│   │   ├── Sidebar.svelte      # 目录树 + 搜索框 + 右键菜单
│   │   └── SettingsModal.svelte # 设置界面（编辑器配置）
│   ├── parser/
│   │   └── markdown.js         # 预处理链 + markdown-it 渲染
│   ├── renderer/
│   │   ├── katex.js            # KaTeX 公式（DOM 文本节点遍历，% 自动转义）
│   │   ├── mermaid.js          # Mermaid 图表（显式标记 + 启发式双通道）
│   │   └── embed.js            # ![[embed]] 处理（递归 + 循环检测）
│   ├── services/
│   │   └── file.js             # Tauri IPC 封装（含 openInEditor / openInNewWindow / searchFiles）
│   └── stores/
│       ├── document.js         # 文档状态 + 主题 + 最近文件
│       └── tabs.js             # 标签页状态管理
├── src-tauri/src/
│   ├── main.rs                 # 入口
│   └── lib.rs                  # Rust 命令 + 文件监听 + 单实例 + 多窗口
└── src-tauri/tauri.conf.json   # Tauri 配置（文件关联、CSP、窗口）
```

## 进度

| 里程碑 | 状态 |
|--------|------|
| M0 技术验证 | ✅ 完成 |
| M1 MVP 阅读器 | ✅ 完成 |
| M2 Obsidian 兼容 | ✅ 完成 |
| M2.5 渲染质量修复 | ✅ 完成（828 文件全量验证通过） |
| M3 搜索 + 外部编辑器 | ✅ 完成 |
| v0.1.1 清理 + 打包发布 | ✅ 完成 |
| v0.1.2 多窗口 + LaTeX 修复 | ✅ 完成 |
| v0.1.3 稳定性 + 安全加固 | ✅ 完成 |
| v0.1.4 数学公式渲染修复 | ✅ 完成 |

## 支持的 Obsidian 语法

- `$...$` / `$$...$$` 数学公式 (KaTeX，`%` 自动转义)
- ` ```mermaid` 代码块（显式标记）+ 启发式检测
- `> [!note]` 等 Callout（28 种类型，支持嵌套、自定义标题、内嵌代码块）
- `[[wikilink]]` / `[[Page|Alias]]` / `[[Page#Heading]]`
- `![[embed]]` 图片和 Markdown 嵌入（递归、循环检测）
- `[^1]` 脚注
- `#tag` / `#nested/tag` 标签
- `- [x]` / `- [ ]` 任务列表（markdown-it-task-lists 插件）
- Frontmatter 解析并显示（文档顶部元数据块）
- 表格、代码高亮

## 核心功能

- 双击 .md 文件打开（通过文件关联 + 单实例 + 多窗口）
- 打开文件夹浏览目录树
- 多窗口支持：右键菜单"Open in new window"，前端 JS API 创建（见下方架构说明）
- 欢迎页：Open Folder 按钮 + 最近文件列表
- 亮色/暗色主题切换（localStorage 持久化）
- 文件外部修改提示刷新（notify crate 监听）
- 最近文件记录（最多 10 条，可一键清除）
- 用外部编辑器打开当前文件（✏️ 按钮 / 右键菜单）
- 设置界面（⚙️ 配置编辑器 + Tabs 开关 + Mermaid 缩放开关）
- 多标签浏览（可选，设置中开启）
- Mermaid 图表缩放开关（适应宽度 / 原始大小+滚动）
- Vault 全局双链解析（同目录优先 → 全局文件名匹配）
- Sidebar 前进/后退/上级目录导航
- 全文搜索（Sidebar 搜索框，去抖 300ms，最多 100 条结果）
- 文档内搜索（Ctrl+F，浏览器原生 find，▲▼ 翻页）
- Ctrl+Shift+F 快捷键聚焦 vault 搜索框

## Rust 命令

| 命令 | 用途 |
|------|------|
| `read_file` | 读取文件内容 |
| `read_directory` | 列出目录（跳过隐藏文件，目录优先排序） |
| `get_pending_file_path` | 冷启动文件路径 |
| `watch_file` | 监听文件变化（AtomicBool 停止信号） |
| `list_markdown_files` | 递归列出 .md 文件（上限 10000） |
| `search_files` | 全文搜索（最多 100 条结果，扫描上限 10000 文件） |
| `open_in_editor` | 用外部编辑器打开文件（支持 Windows 路径） |
| `open_in_new_window` | 在新窗口中打开文件（仅用于单实例回调） |

## ⚠️ 多窗口架构（关键设计决策）

**禁止用 Rust 端 `WebviewWindowBuilder` 创建新窗口。** Tauri 2 在 Windows release 构建中，Rust 端动态创建的窗口无法正确解析 `WebviewUrl::App("index.html")` 到嵌入的前端资源，导致新窗口永远白屏。

**正确方案：前端 JS API 创建窗口**

```
// file.js — openInNewWindow()
1. localStorage.setItem(`__feathermark_window_${label}`, filePath)  // 存储文件路径
2. new WebviewWindow(label, { title, width: 1200, height: 800 })   // JS API 创建窗口
3. 新窗口 onMount → 读取 localStorage → loadFile() → 删除 key     // 新窗口自加载
```

**capabilities 必须包含：**
- `core:window:allow-create`
- `core:webview:allow-create-webview-window`

**例外场景：** Rust 端 `create_file_window()` 仅在单实例回调（`tauri_plugin_single_instance`）中使用，因为该回调无法调用前端 JS API。此场景通过 `WebviewUrl::External(main_window.url())` + `initialization_script` 注入文件路径实现。

## 渲染管线

```
原始 .md 内容
  → parseFrontmatter()      剥离 frontmatter
  → preprocessCallouts()    Callout → HTML div（跟踪代码块状态）
  → preprocessEmbeds()      ![[embed]] → 占位 div
  → preprocessWikilinks()   [[link]] → /vault/ 链接
  → preprocessFootnotes()   [^1] → 上标 + 脚注区
  → preprocessTags()        #tag → <span class="tag">
  → shieldMath()              保护 $...$ / $$...$$ 不被 markdown-it 转义
  → md.render()             markdown-it + task-lists 插件
  → unshieldMath()           还原数学公式
  → escapeMathHtml()        转义数学中的 < > & 防止 DOMPurify 误删
  → DOMPurify.sanitize()    HTML 消毒（SVG 白名单）
  → container.innerHTML     挂载到 DOM
  → renderMathInDOM()       KaTeX DOM 遍历（跳过 code/pre/svg）
  → processMermaidBlocks()  Mermaid SVG 渲染（DOMPurify SVG 消毒）
  → processEmbeds()         异步加载 embed 内容
```

## 开发

```bash
cd mdreader
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

## 安全设计

### CSP
`default-src 'self'; img-src 'self' asset: https://asset.localhost data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`

- `'unsafe-inline'` 是 Tauri 2 + SvelteKit 内联 bootstrap 的必要条件，待 Tauri 支持 nonce-based CSP 后迁移
- 不允许远程图片加载（隐私保护）

### Capabilities 最小权限
- 移除了 `fs:allow-read-file/dir/exists`（使用自定义 Rust 命令替代）
- `opener:allow-open-url` 仅允许 HTTPS
- `opener:allow-open-path` 仅允许 .md/.markdown
- `core:webview:allow-create-webview-window` 用于前端 JS API 创建新窗口

### 输入消毒
- 所有 Markdown → DOMPurify（`ALLOW_DATA_ATTR: false`，显式白名单属性）
- Mermaid SVG → DOMPurify SVG profile
- 编辑器路径 → 黑名单校验（shell 元字符 + 引号 + 控制字符）
- `cmd /c start` 路径 → 拒绝引号、shell 元字符
- `initialization_script` 文件路径 → `serde_json::to_string` 安全编码
- inline math `escapeMathHtml()` → 转义 `$...$` 中的 `<` `>` `&`，防止 DOMPurify 误删
