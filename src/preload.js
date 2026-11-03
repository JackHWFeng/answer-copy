/** preload：只暴露白名单 API，渲染进程无 Node 权限 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  init: function () { return ipcRenderer.invoke('app:init'); },
  saveState: function (items) { return ipcRenderer.invoke('state:save', items); },
  copy: function (text) { return ipcRenderer.invoke('clipboard:write', text); },
  getAlwaysOnTop: function () { return ipcRenderer.invoke('window:get-top'); },
  setAlwaysOnTop: function (v) { return ipcRenderer.invoke('window:set-top', v); },
  confirmClear: function () { return ipcRenderer.invoke('dialog:confirm-clear'); },
});
