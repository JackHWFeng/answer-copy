# Answer Copy

> 把多个 AI Agent 的回复拼成统一格式，一键复制。
>
> Paste many AI answers in, get one clean block out.

![screenshot](docs/screenshot.png)

---

## 这是什么

同时用多个 AI Agent 干活时，它们的回复会分散在好几个窗口里。要把这些回复一起交给总控 Agent，就得反复切换、复制、粘贴。

**Answer Copy 是一个剪贴板中转板**：每个 Agent 一个格子，各自粘贴，勾选需要的几格，一次复制成带标签的完整文本。

复制出来的样子：

```
Codex回复：
（Codex 的回复内容）

WorkBuddy回复：
（WorkBuddy 的回复内容）
```

---

## 功能

- **格子自己定**：首次启动是空的，输入名字就能加一格，不限数量
- **可改名可删除**：悬停格子，右上角出现 `✎` 和 `×`
- **勾选式复制**：只复制「打了勾 **且** 有内容」的格子，空的不占位
- **窗口置顶**：默认置顶，边看 Agent 边粘贴不用切窗口
- **`Ctrl/Cmd + Enter`**：不用鼠标，直接复制
- **内容自动保存**：关掉重开还在

---

## 使用

1. 从 [Releases](../../releases) 下载对应平台的包
2. 打开后，在底部输入框填一个 Agent 名字（比如 `Codex`），回车
3. 把该 Agent 的回复粘进它的格子
4. 勾选你要的格子 → 点「一键复制选中内容」
5. 去总控 Agent 那里 `Ctrl+V`

---

## 开发

```bash
npm install
npm start          # 开发模式
npm test           # 单测（组装逻辑）
```

### 构建

```bash
# Windows
npm run dist

# macOS（需在 macOS 上执行）
npx electron-builder --mac --publish never
```

**macOS 说明**：应用未做代码签名（不打算上架 App Store），首次打开会被 Gatekeeper 拦截。放行方式：

- **macOS 14 及以下**：右键点图标 → 打开 → 再点「打开」
- **macOS 15 及以上**：系统设置 → 隐私与安全性 → 仍要打开
- **命令行**：`xattr -cr "/Applications/Answer Copy.app"`

> ⚠️ macOS 版本**代码已适配，但未在真机验证**。只做了平台判断（关窗不退应用、Cmd 快捷键、应用菜单），实际表现欢迎反馈。

---

## 技术栈

- Electron 39
- 原生 DOM，无前端框架
- 状态存 `app.getPath('userData')/agent-paste-board-state.json`

## 数据在哪

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\Answer Copy\agent-paste-board-state.json` |
| macOS | `~/Library/Application Support/Answer Copy/agent-paste-board-state.json` |
| Linux | `~/.config/Answer Copy/agent-paste-board-state.json` |

删掉这个文件就等于重置。**内容不出本机**——没有网络请求。

---

## License

[MIT](LICENSE)
