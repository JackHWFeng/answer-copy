# Agent 回复中转板 — 开发需求

> 执行者：DeepSeek Harness
> 交付物：一个可双击运行的 Windows 桌面应用
> 原型参考：`C:\Users\hwf1atk\projects\agent-paste-board\index.html`（已可用，是本需求的 UI 基准）

---

## 1. 任务

把上面那个 HTML 原型做成 Electron 桌面应用。

**为什么不做成网页**：需要窗口置顶（用户要边看 Agent 边粘贴），且要能全局快捷键唤出。

---

## 2. 不可破坏条件

| # | 条件 | 说明 |
|---|---|---|
| 1 | **不修改原型文件** | `index.html` 保持原样，作为视觉基准和回退方案 |
| 2 | **不触碰其他项目** | 只在 `C:\Users\hwf1atk\projects\agent-paste-board\` 内工作 |
| 3 | **不重装/降级 Node** | 用现有环境，缺依赖就装到项目内 |
| 4 | **产物必须能双击运行** | 不接受"源码跑得起来但打不出包" |

---

## 3. 功能规格

### 3.1 主界面

5 个格子，每个包含：**勾选框 → 标签 → 多行输入框**。

标签固定为（顺序不可变）：

```
Codex回复：
DeepSeek Harness回复：
WorkBuddy回复：
Trae Work回复：
Grok Bot回复：
```

**视觉基准**：照抄 `index.html`——浅色背景、白卡片、圆角、聚焦时边框高亮、有内容时右侧亮绿点。不要重新设计。

### 3.2 一键复制

**规则**：只收集「**勾选为真** 且 **内容非空**（trim 后）」的格子。

**输出格式**（严格）：

```
Codex回复：
<内容原文>

WorkBuddy回复：
<内容原文>
```

- 每段之间**空一行**
- 内容保持原样，**不做 trim 之外的任何加工**（不换行重排、不截断、不加引号）
- 全部为空时：提示"没有可复制内容"，**不写剪贴板**

### 3.3 其他交互

| 功能 | 要求 |
|---|---|
| 清空 | 清内容但**保留勾选状态**，执行前二次确认 |
| `Ctrl+Enter` | 等同于点击复制 |
| 内容持久化 | 关窗重开后内容还在（用 `app.getPath('userData')` 下的 JSON，或 localStorage） |
| 窗口位置/大小 | 记住上次的 |
| 状态提示 | 复制成功后显示"已复制 N 段"，1.8 秒后淡出 |

### 3.4 窗口行为（Electron 新增）

| 项 | 要求 |
|---|---|
| **置顶** | 默认开启，界面内提供开关（一个图钉图标即可） |
| 初始尺寸 | 约 520 × 760 px |
| 最小尺寸 | 420 × 500 px |
| 菜单栏 | 隐藏（`autoHideMenuBar: true`） |

---

## 4. Agent 检测

**启动时**按下列路径检测，检测不到的 Agent 对应格子**灰显 + 禁用输入**，并显示"未检测到"。

| Agent | 检测路径（任一存在即算） |
|---|---|
| Codex | `%USERPROFILE%\.codex` |
| DeepSeek Harness | `%USERPROFILE%\.dsh` |
| WorkBuddy | `%USERPROFILE%\.workbuddy` |
| Trae Work | `%LOCALAPPDATA%\Programs\TRAE SOLO CN` |
| Grok Bot | `%LOCALAPPDATA%\Programs\Grok Bot` |

**注意**：
- 检测在主进程做（渲染进程没有 fs 权限，除非开 `nodeIntegration`）
- 用 `fs.existsSync`，不要遍历整个目录
- 检测结果不缓存——每次启动重算

**实测环境**：这 5 个路径在本机**全部存在**，开发完成后应当 5 个格子全部可用。如果哪个显示"未检测到"，说明检测代码有 bug。

---

## 5. 技术约束

| 项 | 要求 |
|---|---|
| 框架 | **Electron**（不用 Tauri，避免引入 Rust 工具链） |
| 打包 | `electron-builder`，目标 `win` 的 `nsis` + `dir` |
| 产物位置 | `C:\Users\hwf1atk\projects\agent-paste-board\dist\` |
| 图标 | 可以先用默认图标，**不是阻塞项** |

---

## 6. 打包已知陷阱（本机实测，务必绕开）

> 这些是今天在另外两个项目上刚踩过的，不是理论风险。

### 6.1 exe 图标会丢

`electron-builder` 默认会调 `winCodeSign` 工具改 exe 图标，但**本机域账户缺 `SeCreateSymbolLinkPrivilege`**，解压该工具包时报：

```
ERROR: Cannot create symbolic link ... darwin/10.12/lib/libcrypto.dylib
```

**绕过方式**：加参数 `-c.win.signAndEditExecutable=false`，打包能过，但**exe 图标会保持 Electron 默认**。

如果用户要求自定义图标：打包后用 `rcedit` 补写（命令见 6.2），再用 `--prepackaged` 重出安装包。

### 6.2 rcedit 会静默截断大文件

```bash
rcedit.exe <target.exe> --set-icon <icon.ico>
```

- 对 **200 MB 左右**的主 exe：正常
- 对 **400 MB 以上**的 NSIS/portable 包：**会把文件截断成几百 KB，且不报错**

**判别**：改完后立刻检查文件大小，缩水就是废了。

### 6.3 打包时应用必须关闭

应用在运行时打包会报 `Access is denied`（文件被占用）。先 `taskkill /F /IM <进程名>.exe`。

### 6.4 环境变量（打包时必设）

```bash
export CODEBUDDY_SAFE_DELETE_ENABLED=0      # 否则清理旧产物会被护栏拦
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1,::1
```

### 6.5 可复用的打包命令

```bash
npx electron-builder --win --publish never -c.win.signAndEditExecutable=false
```

---

## 7. 验收标准

**逐条实测，全部通过才算完成。**

| # | 检查项 | 通过条件 |
|---|---|---|
| 1 | 启动 | 双击 `dist\win-unpacked\*.exe`，窗口正常出现，**不白屏** |
| 2 | 检测 | 5 个格子全部可用（本机 5 个 Agent 都在） |
| 3 | 标签 | 5 个标签文字和顺序与 §3.1 完全一致 |
| 4 | 复制格式 | 粘 3 段内容、取消 1 个勾 → 复制 → 粘到记事本：**正好 2 段，格式符合 §3.2** |
| 5 | 空内容跳过 | 勾选但空着的格子**不出现在复制结果里** |
| 6 | 全空保护 | 全部为空时点复制 → 有提示，剪贴板**未被写入** |
| 7 | 持久化 | 填内容 → 关窗 → 重开 → 内容还在 |
| 8 | 置顶 | 开启置顶后，点别的窗口，本窗口**仍在最前** |
| 9 | `Ctrl+Enter` | 光标在输入框内按快捷键，触发复制 |
| 10 | 清空 | 清空后内容没了，**勾选状态保留** |

**验收方式**：把每条的实测结果贴回来，写清"通过"或"失败 + 现象"。**不要只写"已完成"**。

---

## 8. 需要澄清的问题

以下若与你的理解不一致，**先问再做**：

1. 全局快捷键（如 `Ctrl+Alt+A` 唤出窗口）要不要？—— 需求未明确，**默认不做**，除非用户追加
2. 是否要支持"最小化到托盘"？—— **默认不做**

---

## 9. 完成后交付

| 项 | 内容 |
|---|---|
| 可执行文件 | `dist\win-unpacked\` 下的主 exe（绿色版，能直接双击） |
| 安装包 | `dist\*.exe`（NSIS） |
| 说明 | 一段话：怎么用、快捷键是什么、数据存在哪个文件 |
