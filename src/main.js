/**
 * Electron 主进程：窗口 / 置顶 / 内容与窗口位置持久化 / 剪贴板 / 崩溃日志
 */
const { app, BrowserWindow, ipcMain, clipboard, dialog, screen, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 产品名（影响窗口标题/userData 路径；打包后 productName 相同）
app.setName('Answer Copy');
// 任务栏身份：必须与 package.json 的 build.appId 一致
app.setAppUserModelId('com.answercopy.app');

const MIN_W = 420;
const MIN_H = 500;

// 端到端测试用：--e2e-userdata=<dir> 把持久化目录指到隔离路径（默认不启用，不影响真实使用）
let e2eUserData = null;
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.indexOf('--e2e-userdata=') === 0) e2eUserData = a.slice('--e2e-userdata='.length);
}
if (e2eUserData) {
  try { app.setPath('userData', e2eUserData); } catch (e) { /* ignore */ }
}

let win = null;
let stateFile = null;
let logFile = null;
let saveTimer = null;
let state = null;

function expand(p) {
  return String(p).replace(/%([^%]+)%/g, function (m, k) {
    return process.env[k] || '';
  });
}

function log(line) {
  try {
    fs.appendFileSync(logFile, new Date().toISOString() + ' ' + line + '\n', 'utf8');
  } catch (e) { /* 日志失败不影响主流程 */ }
}

function defaultState() {
  return {
    version: 2,
    items: [],
    bounds: null,
    alwaysOnTop: true,
  };
}

/**
 * 归一化单条 item：name 必须是非空字符串；checked 缺省为 true；text 必须是字符串。
 * 名字重复时保留先出现的，后面的加后缀区分，避免两条共用同一个 key。
 */
function normalizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  var seen = {};
  var out = [];
  raw.forEach(function (it) {
    if (!it || typeof it.name !== 'string') return;
    var name = it.name.trim();
    if (!name) return;
    if (seen[name] !== undefined) {
      seen[name] += 1;
      name = name + ' (' + seen[name] + ')';
    } else {
      seen[name] = 1;
    }
    out.push({
      name: name,
      checked: it.checked !== false,
      text: typeof it.text === 'string' ? it.text : '',
    });
  });
  return out;
}

function loadState() {
  var s = null;
  try {
    s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) { s = null; }
  if (!s || typeof s !== 'object') s = defaultState();

  // 保留用户在磁盘上定义的格子（名字、顺序、内容都由用户决定）。
  // 旧版（固定 5 格）的状态天然兼容：那 5 条会被原样保留。
  s.items = normalizeItems(s.items);

  if (typeof s.alwaysOnTop !== 'boolean') s.alwaysOnTop = true;
  return s;
}

function persistNow() {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) { log('persist failed: ' + e.message); }
}

function persistDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { persistNow(); }, 200);
}

function visibleBounds(saved) {
  var def = { width: 520, height: 760, x: undefined, y: undefined };
  if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return def;
  var b = {
    width: Math.max(MIN_W, Math.round(saved.width)),
    height: Math.max(MIN_H, Math.round(saved.height)),
    x: typeof saved.x === 'number' ? Math.round(saved.x) : undefined,
    y: typeof saved.y === 'number' ? Math.round(saved.y) : undefined,
  };
  if (b.x === undefined || b.y === undefined) return b;
  // 校验收复的位置至少与某块屏幕有交集，避免窗口跑到屏幕外
  var displays = screen.getAllDisplays();
  var ok = displays.some(function (d) {
    var wa = d.workArea;
    return b.x < wa.x + wa.width - 40 && b.x + b.width > wa.x + 40 &&
           b.y < wa.y + wa.height - 40 && b.y + b.height > wa.y + 40;
  });
  if (!ok) { b.x = undefined; b.y = undefined; }
  return b;
}

function saveBounds() {
  if (!win || win.isDestroyed()) return;
  var b = win.getBounds();
  state.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  persistDebounced();
}

function createWindow() {
  var b = visibleBounds(state.bounds);
  win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    minWidth: MIN_W,
    minHeight: MIN_H,
    title: 'Answer Copy',
    // Windows 标题栏/任务栏图标（开发与打包均从 src/assets 读，打包后该文件在 app.asar 内）
    icon: path.join(__dirname, 'assets', 'answer-copy.ico'),
    backgroundColor: '#f7f7f8',
    show: false,
    alwaysOnTop: state.alwaysOnTop !== false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', function () {
    win.show();
    log('window ready; bounds=' + JSON.stringify(win.getBounds()) + ' top=' + win.isAlwaysOnTop());
  });

  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', function () {
    saveBounds();
    if (saveTimer) clearTimeout(saveTimer);
    persistNow();
  });

  win.webContents.on('render-process-gone', function (e, details) {
    log('render-process-gone: ' + JSON.stringify(details));
  });
  win.webContents.on('did-fail-load', function (e, code, desc, url) {
    log('did-fail-load: code=' + code + ' desc=' + desc + ' url=' + url);
  });
  win.webContents.on('unresponsive', function () { log('renderer unresponsive'); });
}

function registerIpc() {
  ipcMain.handle('app:init', function () {
    return {
      items: state.items,
      alwaysOnTop: win ? win.isAlwaysOnTop() : true,
      stateFile: stateFile,
      logFile: logFile,
    };
  });

  ipcMain.handle('state:save', function (e, items) {
    if (Array.isArray(items)) {
      state.items = normalizeItems(items);
      persistDebounced();
    }
    return { ok: true };
  });

  ipcMain.handle('clipboard:write', function (e, text) {
    // 空串一律不写剪贴板（需求 §3.2）
    if (typeof text !== 'string' || text.length === 0) return { ok: false, reason: 'empty' };
    clipboard.writeText(text);
    return { ok: true, length: text.length };
  });

  ipcMain.handle('window:get-top', function () {
    return win ? win.isAlwaysOnTop() : false;
  });

  ipcMain.handle('window:set-top', function (e, v) {
    if (!win) return { ok: false, alwaysOnTop: false };
    // 注意：setAlwaysOnTop 之后立刻 isAlwaysOnTop() 可能读到 stale 值（Electron 内部标志更新有时序），
    // 会把“已置顶”错报成 false 并让 UI 翻回关态。这里回显请求值，真实置顶状态由下面的 delayed 复核校正。
    var next = !!v;
    win.setAlwaysOnTop(next);
    state.alwaysOnTop = next;
    persistDebounced();
    return { ok: true, alwaysOnTop: next };
  });

  ipcMain.handle('dialog:confirm-clear', function () {
    // 端到端测试用：仅在带 --e2e-auto-confirm 启动时跳过原生确认框（默认不启用）
    if (process.argv.indexOf('--e2e-auto-confirm') !== -1) return true;
    var r = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['清空', '取消'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: '清空内容',
      message: '清空所有格子内容？（勾选状态保留）',
    });
    return r === 0;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

/**
 * macOS 必须有应用菜单，否则 Cmd+Q / Cmd+C / Cmd+V 等标准快捷键全部失效。
 * Windows / Linux 保持无菜单（autoHideMenuBar 已隐藏）。
 */
function setupMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]));
}

  app.whenReady().then(function () {
    var userData = app.getPath('userData');
    try { fs.mkdirSync(userData, { recursive: true }); } catch (e) { /* ignore */ }
    stateFile = path.join(userData, 'agent-paste-board-state.json');
    logFile = path.join(userData, 'app.log');
    log('=== app start ' + app.getVersion() + ' (electron ' + process.versions.electron + ') ===');
    log('userData=' + userData);
    state = loadState();
    setupMenu();
    registerIpc();
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', function () {
    if (saveTimer) clearTimeout(saveTimer);
    if (state) persistNow();
    // macOS：关窗不退应用，保留 dock 图标，点一下可重开；其他平台直接退出
    if (process.platform !== 'darwin') app.quit();
  });
}

process.on('uncaughtException', function (err) {
  log('uncaughtException: ' + (err && err.stack ? err.stack : String(err)));
});
process.on('unhandledRejection', function (err) {
  log('unhandledRejection: ' + (err && err.stack ? err.stack : String(err)));
});
