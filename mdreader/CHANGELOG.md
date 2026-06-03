# CHANGELOG

## v0.1.5 (2026-06-03)

### ✨ 新功能

- **多窗口**：右键菜单 "Open in new window"，前端 JS API 创建（解决 Tauri 2 Windows release 下 `WebviewUrl::App` 白屏问题）
- **独立欢迎窗口**：双击 `.md` 自动开新窗口，无文件时创建独立欢迎窗口
- **最近笔记库**：欢迎页 Vaults/Files Tab 切换，最多记录 10 个笔记库
- **主题色自定义**：12 种预设 + 自定义取色器，CSS 变量驱动，全 UI 联动
- **外部链接打开系统浏览器**：HTTPS 链接通过 opener 插件打开
- **Mermaid 11.4.1**：锁定版本对齐 Obsidian 兼容性

### 🔒 安全加固（14 项）

- `cmd /c start` 路径注入修复：拒绝引号 `"` `'` 及 shell 元字符
- `initialization_script` JS 注入修复：改用 `serde_json::to_string` 安全编码
- Mermaid SVG 输出经 DOMPurify SVG profile 消毒
- DOMPurify 配置收紧：`ALLOW_DATA_ATTR: false`，显式白名单属性
- CSP 完善：`font-src 'self' data:`（KaTeX 字体），`script-src 'self' 'unsafe-inline'`（SvelteKit 必需）
- Capabilities 最小权限：移除冗余 `fs` 插件权限，`opener` 仅允许 HTTPS 和 .md/.markdown
- Inline math regex 收紧：防止 `$5 and $10` 等货币值被误解析为公式
- 编辑器路径校验：黑名单元字符 + 260 字符上限（允许 Windows 反斜杠路径）
- 递归目录扫描：跳过符号链接 + 深度限制 20 层 + 文件数上限 10,000
- Watcher per-window 隔离 + 窗口销毁时自动清理
- Embed 路径 HTML 转义
- Mutex 中毒恢复
- 原子操作 Release/Acquire 内存序
- localStorage JSON.parse 类型验证

### 🐛 Bug 修复（35 项）

**多窗口**
- 🔥 新窗口白屏：`WebviewUrl::App` 在 Windows release 不工作 → 改用前端 JS API + ACL 权限
- 关闭最后 tab 显示过期内容 → 调用 `clearDocument()`

**渲染管线**
- preprocessCallouts：代码块内误触发 / callout 内代码块检测失败 / 嵌套语义错误
- preprocessWikilinks / preprocessEmbeds / preprocessFootnotes：未跳过代码块和行内代码
- preprocessFootnotes：多行脚注截断 + 不渲染 markdown
- Mermaid 初始化失败后永久不可用 → initPromise 成功/失败后均清空
- Mermaid 主题切换失败 → initPromise 成功后重置
- Embed 内 wikilink 路径解析错误 → 使用 vault root
- **Wikilink 子路径编码错误** → `encodeURIComponent` 只编码路径段，保留 `/`
- **表格/Callout 中数学公式渲染失败** → 恢复 `escapeMathHtml` 管线，inline regex 恢复原始 `.+?`

**状态管理**
- Wikilink fallback 竞态 → 加 seq 检查
- loadFile 未 await 导致白屏
- watcher 全局互杀 → per-window HashMap
- watchFile 失败阻塞文件显示 → 分离 catch
- tabs 模式状态不同步
- file-changed 路径对比不一致 → 反斜杠归一化
- clearDocument 共享引用问题 → 展开复制
- .markdown 扩展名 tab 标题未处理

**配置与构建**
- app.html 标题未更新（"Tauri + SvelteKit App" → "Feathermark"）
- 缺少 jsconfig.json 导致类型检查失败
- is_safe_editor 拒绝反斜杠 → Windows 自定义编辑器路径不可用
- 单实例回调 cwd 未使用 → 相对路径解析为绝对路径
- 15 处 CSS 硬编码 #646cff → var(--accent)
- TabBar 强调色硬编码
- Sidebar 右键菜单 a11y 警告

---

## 已知限制

### 接受的风险（有缓解措施）
- `script-src 'unsafe-inline'`：Tauri 2 + SvelteKit 必需，DOMPurify 提供 XSS 防护
- `markdown-it html: true`：Obsidian 兼容需要，DOMPurify 消毒
- 自定义 IPC 命令无路径范围限制：路径来自用户 UI 选择，已移除冗余 fs 插件权限

### 待解决
- Frontmatter 解析简陋（只处理单行 key: value）
- 代码块检测不支持 tilde fence（~~~）和多 backtick fence
- Sidebar 搜索无结果高亮
- localStorage 跨窗口不同步（主题/主题色）

---

## 版本历史

| 版本 | 状态 | 主要变更 |
|------|------|----------|
| v0.1.0 | ✅ | 基础 Markdown 阅读器 |
| v0.1.1 | ✅ | 清理 + 打包发布 |
| v0.1.2 | ✅ | 多窗口 + LaTeX 大括号修复 |
| v0.1.3 | ✅ | IPC 死锁修复 + XSS 安全 + 稳定性 |
| v0.1.4 | ✅ | 数学公式 DOMPurify 修复 |
| v0.1.5 | ✅ | 多窗口重构 + 安全审查加固（14 项安全 + 35 项 Bug 修复） |

---

## 下一步计划

### v0.1.6
1. 测试体系：vitest + 单元测试 + CI
2. 无障碍性：TabBar ARIA roles + 键盘导航
3. Frontmatter 增强：YAML 解析器
4. tilde fence / 多 backtick fence 支持
5. Mermaid 启发式检测恢复

### v0.2.0
1. 搜索增强（结果高亮、正则支持）
2. 性能优化（大文件虚拟滚动、Mermaid 懒加载）
3. nonce-based CSP（待 Tauri 支持）
