const { contextBridge, ipcRenderer, webUtils } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_, ...a) => cb(...a));
contextBridge.exposeInMainWorld('api', {
  listDir: (d) => ipcRenderer.invoke('list-dir', d),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, c) => ipcRenderer.invoke('write-file', p, c),
  saveAs: (n, c) => ipcRenderer.invoke('save-as', n, c),
  confirmDiscard: (n) => ipcRenderer.invoke('confirm-discard', n),
  pathFor: (file) => webUtils.getPathForFile(file),
  openPaths: (paths) => ipcRenderer.send('open-paths', paths),
  setTheme: (t) => ipcRenderer.send('set-theme', t),
  on: (ch, cb) => ipcRenderer.on(ch, (_, ...a) => cb(...a)),
});
