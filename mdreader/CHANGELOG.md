# CHANGELOG

## v0.1.5 (2026-06-01)

基于 v0.1.4 重新实现，修复了 v0.1.6 尝试中引入的所有问题。

### ✨ 新功能

- **独立欢迎窗口**：双击 `.md` 自动开新窗口，无文件时创建独立欢迎窗口
- **最近笔记库**：欢迎页 Vaults/Files Tab 切换，最多记录 10 个笔记库
- **主题色自定义**：12 种预设 + 自定义取色器，CSS 变量驱动
- **外部链接打开系统浏览器**：http/https 链接通过 opener 插件打开

### 🔒 安全加固

- watcher per-window 隔离（HashMap 按窗口 label）
- 编辑器路径注入校验（黑名单 + 最大 260 字符）
- 递归目录跳过符号链接 + 深度限制 20 层
- Mutex unwrap_or_else 防中毒
- 原子 Release/Acquire 内存序
- DOMPurify 关闭 ALLOW_UNKNOWN_PROTOCOLS
- embed 路径 escapeHtml 转义
- capabilities 补全 welcome-* + fs:allow-read-dir

### 🐛 Bug 修复（16 项）

- loadFile 未 await 导致新窗口白屏
- watcher 全局互杀
- Mermaid 初始化永久失败
- watchFile 失败阻塞文件显示
- tabs 模式状态不同步
- embed 循环检测可绕过
- 标签预处理误伤标题行
- 图片路径特殊字符
- Sidebar goBack/goForward 竞态
- afterUpdate 不必要的 innerHTML 重设
- get_file_path 死命令
- getFileInfo/getFileName 死函数
- watchFile 传多余 window 参数
- openInNewWindow 参数名不匹配
- ALLOW_UNKNOWN_PROTOCOLS: true
- vite.config.js ts-expect-error 过期

---

## v0.1.6 尝试记录（已回滚）

v0.1.6 在旧版 v0.1.5 基础上尝试了三轮改进，最终因引入严重问题被整体回滚。

### 尝试的内容

第一轮（c2da46a）：全链路加固 + 无障碍性
- 编辑器黑名单补全 + 最大 260 字符
- 递归目录跳过符号链接
- TabBar ARIA roles + 键盘导航
- 图标按钮 aria-label
- capabilities 添加 fs:allow-read-dir

第二轮（eee6472）：测试体系 + 第四轮审查
- vitest + 74 个单元测试
- GitHub Actions CI
- Mermaid 初始化失败恢复
- 删除死命令/死函数

第三轮（47723b6）：5 个运行时 Bug 修复 + 文档
- 标签页模式切换状态同步
- Sidebar goBack/goForward sequence guard
- CHANGELOG + README 完善

### 引入的问题

1. **新窗口白屏**：loadFile() 未 await，Promise rejection 无人处理
2. **watcher 全局互杀**：watcher_stop_signal 仍是全局单例
3. **Mermaid 初始化永久失败**：initPromise 被赋值为 rejected promise 后无法重试
4. **watchFile 失败阻塞显示**：await watchFile() 在 try 块内
5. **tabs 模式状态不同步**：只调用 addTab 不调用 setDocument
6. **embed XSS**：embedPath 未转义直接拼 HTML
7. **编译缓存 stale**：旧 capabilities.json 未清理

### 回滚原因

1. 修复引入了新 bug（白屏、watcher 互杀）
2. 编译缓存未清理导致 capabilities 不一致
3. 缺乏端到端测试验证
4. 改动量过大，难以定位具体问题 commit

### 教训

1. 大改动应拆分为小 commit，每个可独立验证
2. 修改 capabilities/权限 后需 cargo clean
3. async 函数必须处理 rejection
4. 多窗口场景下全局 Mutex 会导致跨窗口干扰
5. 错误恢复机制必须可测试

---

## 已知待解决问题

### High
- Frontmatter 解析过于简陋（只处理 key: value 单行）
- preprocessCallouts 代码块边界检测不够健壮

### Medium
- window.find 非标准 API（仅 WebView2/WebKit）
- Tab counter 单调递增永不重置
- preprocessWikilinks 未处理相对路径
- Sidebar 搜索无结果高亮
- embed 深度无限递归（有循环检测但无深度限制）
- Mermaid heuristic 检测已移除（只认 mermaid-block class）

### Low
- CSS.escape 兼容性
- Sidebar 搜索 debounce 固定 300ms
- localStorage 跨窗口共享

---

## 版本对照

| 版本 | 状态 | 主要变更 |
|------|------|----------|
| v0.1.0 | ✅ | 基础 Markdown 阅读器 |
| v0.1.1 | ✅ | 清理 + 打包发布 |
| v0.1.2 | ✅ | 多窗口 + LaTeX 大括号修复 |
| v0.1.3 | ✅ | IPC 死锁修复 + XSS 安全 + 稳定性 |
| v0.1.4 | ✅ | 数学公式 DOMPurify 修复 |
| v0.1.5 | ✅ | 独立窗口 + 最近笔记库 + 主题色 + 全链路加固 |
| v0.1.6 | ❌ 回滚 | 测试体系 + 无障碍性（引入新问题） |

---

## 下一步计划

### v0.1.6（重新实现，小步迭代）
1. 测试体系：vitest + 单元测试 + CI
2. 无障碍性：TabBar ARIA roles + 键盘导航 + aria-label
3. Frontmatter 增强：支持引号、多行值
4. embed 深度限制
5. Mermaid 代码内容检测恢复

### v0.2.0
1. 编辑功能
2. 搜索增强（结果高亮、正则支持）
3. 性能优化（大文件虚拟滚动、Mermaid 懒加载）
4. 插件系统
