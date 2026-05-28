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
│   │   └── file.js             # Tauri IPC 封装（invokeWithTimeout 超时保护）
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

- `$...$` / `$$...$$` 数学公式 (KaTeX，`%` 自动转义，`\arccot` 等自定义宏)
- ` ```mermaid` 代码块（显式标记）+ 启发式检测（仅限无语言标识的代码块）
- `> [!note]` 等 Callout（28 种类型，支持嵌套、自定义标题、内嵌代码块）
- `[[wikilink]]` / `[[Page|Alias]]` / `[[Page#Heading]]` / `[[#当前文档标题]]`
- `![[embed]]` 图片和 Markdown 嵌入（递归、循环检测、XSS 安全）
- `[^1]` 脚注（可点击跳转）
- `#tag` / `#nested/tag` 标签（行内代码中不处理）
- `- [x]` / `- [ ]` 任务列表（markdown-it-task-lists 插件）
- Frontmatter 解析并显示（兼容 Windows \r\n 换行）
- 表格、代码高亮

## 核心功能

- 双击 .md 文件打开（通过文件关联 + 单实例 + 多窗口）
- 打开文件夹浏览目录树
- 多窗口支持：双击 .md 自动开新窗口，右键菜单"Open in new window"
- 欢迎页：Open Folder 按钮 + 最近文件列表
- 亮色/暗色主题切换（localStorage 持久化）
- 文件外部修改提示刷新（notify crate 监听，per-window 独立监听）
- 最近文件记录（最多 10 条，可一键清除）
- 用外部编辑器打开当前文件（✏️ 按钮 / 右键菜单）
- 设置界面（⚙️ 配置编辑器 + Tabs 开关 + Mermaid 缩放开关）
- 多标签浏览（可选，设置中开启）
- Mermaid 图表缩放开关（适应宽度 / 原始大小+滚动）
- Vault 全局双链解析（同目录优先 → 全局文件名匹配，支持 .md 和 .markdown）
- Sidebar 前进/后退/上级目录导航
- 全文搜索（Sidebar 搜索框，去抖 300ms，最多 100 条结果）
- 文档内搜索（Ctrl+F，浏览器原生 find，▲▼ 翻页）
- Ctrl+Shift+F 快捷键聚焦 vault 搜索框

## Rust 命令

| 命令 | 用途 |
|------|------|
| `read_file` | 读取文件内容 |
| `read_directory` | 列出目录（跳过隐藏文件，目录优先排序） |
| `get_file_path` | 规范化路径 |
| `get_pending_file_path` | 冷启动文件路径 |
| `watch_file` | 监听文件变化（per-window HashMap 停止信号，窗口关闭自动清理） |
| `list_markdown_files` | 递归列出 .md/.markdown 文件（深度限制 20 层，大小写不敏感） |
| `search_files` | 全文搜索（最多 100 条，深度限制 20 层） |
| `open_in_editor` | 用外部编辑器打开文件（自动查找常见安装路径） |
| `open_in_new_window` | 在新窗口中打开文件（thread::spawn 避免 IPC 死锁） |
| `show_in_folder` | 在文件资源管理器中定位并选中文件（raw_arg + canonicalize） |

### Rust 安全实践

- 所有 `Mutex::lock()` 使用 `lock()` 辅助函数，中毒时恢复而非 panic
- `normalize_path()` 统一处理相对/绝对路径
- `collect_markdown_files()` 递归深度限制 20 层，防止符号链接栈溢出
- 单实例回调和 `open_in_new_window` 使用 `thread::spawn` 创建窗口，避免阻塞事件循环

## 渲染管线

```
原始 .md 内容
  → parseFrontmatter()      剥离 frontmatter（兼容 \r\n 换行）
  → preprocessCallouts()    Callout → HTML div（跟踪代码块状态）
  → preprocessEmbeds()      ![[embed]] → 占位 div
  → preprocessWikilinks()   [[link]] → /vault/ 链接（[[#Heading]] → 锚点链接）
  → preprocessFootnotes()   [^1] → 上标 + 脚注区（包裹 <a> 标签可点击）
  → preprocessTags()        #tag → <span class="tag">（跳过行内代码）
  → shieldMath()              保护 $...$ / $$...$$ 不被 markdown-it 转义
  → md.render()             markdown-it + task-lists 插件
  → unshieldMath()           还原数学公式
  → DOMPurify.sanitize()    HTML 消毒（SVG 白名单）
  → container.innerHTML     挂载到 DOM（仅内容变化时重写）
  → renderMathInDOM()       KaTeX DOM 遍历（跳过 code/pre/svg，trust:false）
  → processMermaidBlocks()  Mermaid SVG 渲染（仅无语言标识时启发式检测）
  → processEmbeds()         异步加载 embed 内容（textContent 防 XSS）
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
