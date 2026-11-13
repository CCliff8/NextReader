const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let win;
const pendingOpen = [];

function createWindow() {
  win = new BrowserWindow({
    width: 1300, height: 820, minWidth: 700, minHeight: 400,
    titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile('renderer/index.html');
  win.on('closed', () => { win = null; });
}

const send = (ch, ...a) => win && win.webContents.send(ch, ...a);
const readFile = (p) => ({ path: p, name: path.basename(p), content: fs.readFileSync(p, 'utf8') });

async function openFiles() {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Text & Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] }, { name: 'All files', extensions: ['*'] }]
  });
  if (!r.canceled) send('files-opened', r.filePaths.map(readFile));
}

async function openFolder() {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (!r.canceled) send('folder-opened', r.filePaths[0]);
}

function listDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => ({ name: e.name, path: path.join(dir, e.name), dir: e.isDirectory() }))
    .filter(e => e.dir || /\.(md|markdown|mdx|txt)$/i.test(e.name))
    .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
}

ipcMain.on('open-paths', (_, paths) => {
  const files = [];
  for (const p of paths) {
    try {
      if (fs.statSync(p).isDirectory()) { send('folder-opened', p); continue; }
      const f = readFile(p);
      if (!f.content.includes('\u0000')) files.push(f);   // skip binary files
    } catch {}
  }
  if (files.length) send('files-opened', files);
});
ipcMain.handle('list-dir', (_, d) => listDir(d));
ipcMain.handle('read-file', (_, p) => readFile(p));
ipcMain.handle('write-file', (_, p, c) => { fs.writeFileSync(p, c, 'utf8'); return true; });
ipcMain.handle('save-as', async (_, suggested, content) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: suggested });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, content, 'utf8');
  return { path: r.filePath, name: path.basename(r.filePath) };
});
ipcMain.handle('confirm-discard', async (_, name) => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2,
    message: `Save changes to "${name}"?`
  });
  return ['save', 'discard', 'cancel'][r.response];
});
ipcMain.on('set-theme', (_, t) => { nativeTheme.themeSource = t; });

function buildMenu() {
  const item = (label, accelerator, ch) => ({ label, accelerator, click: () => send(ch) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      item('Settings…', 'CmdOrCtrl+,', 'cmd-settings'),
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'File', submenu: [
      item('New', 'CmdOrCtrl+N', 'cmd-new'),
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: openFiles },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: openFolder },
      { type: 'separator' },
      item('Save', 'CmdOrCtrl+S', 'cmd-save'),
      item('Save As…', 'CmdOrCtrl+Shift+S', 'cmd-save-as'),
      item('Close Tab', 'CmdOrCtrl+W', 'cmd-close-tab'),
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [
      { label: 'Read', accelerator: 'CmdOrCtrl+1', click: () => send('cmd-mode', 'read') },
      { label: 'Edit', accelerator: 'CmdOrCtrl+2', click: () => send('cmd-mode', 'edit') },
      { label: 'Split', accelerator: 'CmdOrCtrl+3', click: () => send('cmd-mode', 'split') },
      item('Toggle Read / Edit', 'CmdOrCtrl+E', 'cmd-toggle-mode'),
      { type: 'separator' },
      item('Toggle Sidebar', 'CmdOrCtrl+B', 'cmd-sidebar'),
      item('Find', 'CmdOrCtrl+F', 'cmd-find'),
      { type: 'separator' },
      { role: 'toggleDevTools' }, { role: 'togglefullscreen' },
    ] },
    { role: 'windowMenu' },
  ]));
}

app.on('open-file', (e, p) => {
  e.preventDefault();
  if (win && win.webContents && !win.webContents.isLoading()) send('files-opened', [readFile(p)]);
  else pendingOpen.push(p);
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  win.webContents.on('did-finish-load', () => {
    const argv = process.argv.slice(app.isPackaged ? 1 : 2).filter(a => !a.startsWith('-') && fs.existsSync(a));
    const files = [...pendingOpen.splice(0), ...argv].map(readFile);
    if (files.length) send('files-opened', files);
  });
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); });
