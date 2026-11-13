const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const base = new URL('../node_modules/monaco-editor/min/', location.href).href;
const LANG_BY_EXT = { md: 'markdown', markdown: 'markdown', mdx: 'markdown', txt: 'plaintext', py: 'python', sql: 'sql',
  js: 'javascript', mjs: 'javascript', ts: 'typescript', json: 'json', html: 'html', css: 'css', sh: 'shell',
  yml: 'yaml', yaml: 'yaml', java: 'java', c: 'c', cpp: 'cpp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php', xml: 'xml' };

/* ---------- Settings ---------- */
const DEFAULTS = { theme: 'system', readFont: 'sans', readSize: 16, readWidth: 760, editorSize: 14,
  wordWrap: true, lineNumbers: true, defaultMode: 'read' };
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nr-settings') || '{}') }; } catch {}
const persist = () => { try { localStorage.setItem('nr-settings', JSON.stringify(settings)); } catch {} };

const THEMES = [
  { id: 'system', label: 'System', bg: 'linear-gradient(115deg,#fff 50%,#1c1d20 50%)', bar: '#8b9099' },
  { id: 'light', label: 'Light', bg: '#ffffff', bar: '#c9ced6' },
  { id: 'dark', label: 'Dark', bg: '#1c1d20', bar: '#4a4d54' },
  { id: 'soft', label: 'Soft', bg: '#faf6ef', bar: '#c0572f' },
];
const FONTS = { sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                serif: '"Iowan Old Style", Charter, "Palatino Linotype", Georgia, serif' };

const WELCOME = `# Welcome to NextReader

Open a file with **⌘O** or a folder with **⇧⌘O**.

**Read** (⌘1) is for reading, **Edit** (⌘2) for writing, **Split** (⌘3) for both.
Change the look from the half-moon button or Settings (⌘,).

**Quick code blocks:** type \`/python\`, your code, then \`/end\`.

*Double-click this page, or press ⌘2, to start writing.*
`;

let editor, monaco;
const tabs = [];   // { path, name, model, savedVersion, mode }
let active = null;
let previewTimer;
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => settings.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : settings.theme;

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.style.setProperty('--read-size', settings.readSize + 'px');
  root.style.setProperty('--read-width', settings.readWidth + 'px');
  root.style.setProperty('--read-font', FONTS[settings.readFont]);
  window.api.setTheme(settings.theme === 'system' ? 'system' : settings.theme === 'dark' ? 'dark' : 'light');
  if (editor) {
    monaco.editor.setTheme('nr-' + resolvedTheme());
    editor.updateOptions({ fontSize: settings.editorSize, wordWrap: settings.wordWrap ? 'on' : 'off',
      lineNumbers: settings.lineNumbers ? 'on' : 'off' });
  }
  renderThemeMenu(); syncSettingsUI();
}
darkMQ.addEventListener('change', applySettings);
const setSetting = (k, v) => { settings[k] = v; persist(); applySettings(); };

/* ---------- Theme popover ---------- */
function renderThemeMenu() {
  const m = $('#theme-menu'); m.innerHTML = '';
  THEMES.forEach(t => {
    const b = document.createElement('button');
    b.className = settings.theme === t.id ? 'on' : '';
    b.innerHTML = `<span class="dot" style="background:${t.bg}"></span>${t.label}`;
    b.onclick = () => { setSetting('theme', t.id); m.hidden = true; };
    m.appendChild(b);
  });
}
$('#btn-theme').onclick = (e) => { e.stopPropagation(); $('#theme-menu').hidden = !$('#theme-menu').hidden; };
document.addEventListener('click', () => { $('#theme-menu').hidden = true; });

/* ---------- Settings sheet ---------- */
function buildCards() {
  const box = $('#theme-cards');
  THEMES.forEach(t => {
    const c = document.createElement('button'); c.className = 'card'; c.dataset.id = t.id;
    c.innerHTML = `<div class="sw" style="background:${t.bg}"><i style="top:12px;width:55%;background:${t.bar}"></i>
      <i style="top:24px;width:75%;background:${t.bar};opacity:.5"></i><i style="top:34px;width:40%;background:${t.bar};opacity:.5"></i></div>${t.label}`;
    c.onclick = () => setSetting('theme', t.id);
    box.appendChild(c);
  });
}
function syncSettingsUI() {
  $$('#theme-cards .card').forEach(c => c.classList.toggle('on', c.dataset.id === settings.theme));
  $$('[data-key]').forEach(el => {
    const k = el.dataset.key;
    if (el.type === 'range') { el.value = settings[k]; const o = $('#o-' + k); if (o) o.textContent = settings[k] + 'px'; }
    else if (el.type === 'checkbox') el.checked = settings[k];
    else $$(`[data-key="${k}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === settings[k]));
  });
}
$$('[data-key]').forEach(el => {
  const k = el.dataset.key;
  if (el.type === 'range') el.oninput = () => setSetting(k, +el.value);
  else if (el.type === 'checkbox') el.onchange = () => setSetting(k, el.checked);
  else el.querySelectorAll('button').forEach(b => b.onclick = () => setSetting(k, b.dataset.v));
});
const openSettings = () => { $('#settings').hidden = false; };
const closeSettings = () => { $('#settings').hidden = true; editor && editor.focus(); };
$('#btn-settings').onclick = openSettings;
$('#settings-close').onclick = closeSettings;
$('#settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSettings(); $('#theme-menu').hidden = true; } });

/* ---------- Markdown rendering ---------- */
marked.setOptions({ gfm: true, breaks: false });
marked.use({ renderer: {
  code({ text, lang }) {
    const l = (lang || '').trim().split(/\s+/)[0].toLowerCase();
    const alias = { js: 'javascript', py: 'python', ts: 'typescript', sh: 'bash', yml: 'yaml', 'c++': 'cpp' }[l] || l;
    const ok = alias && hljs.getLanguage(alias);
    const html = ok ? hljs.highlight(text, { language: alias, ignoreIllegals: true }).value
                    : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="hljs${ok ? ' language-' + alias : ''}">${html}</code></pre>`;
  }
} });

const previewSource = (t) => (t.welcome && !t.model.getValue()) ? WELCOME : t.model.getValue();

function renderPreview() {
  if (!active || active.mode === 'edit') return;
  const el = $('#preview'), pane = $('#preview-pane'), scroll = pane.scrollTop;
  el.innerHTML = DOMPurify.sanitize(marked.parse(expandShortcuts(previewSource(active), hljs)));
  const dir = active.path ? active.path.replace(/[^/]*$/, '') : null;
  if (dir) el.querySelectorAll('img[src]').forEach(img => {
    const s = img.getAttribute('src');
    if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(s)) img.src = 'file://' + encodeURI(s.startsWith('/') ? s : dir + s);
  });
  pane.scrollTop = scroll;
}
const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 120); };
const slug = (s) => s.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

$('#preview').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a) return;
  const href = a.getAttribute('href') || '';
  e.preventDefault();
  if (href.startsWith('#')) {
    const t = [...$('#preview').querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h => slug(h.textContent) === href.slice(1));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  } else if (/^https?:/i.test(href)) window.open(href);
  else if (/\.(md|markdown|mdx)$/i.test(href) && active.path) {
    const p = decodeURIComponent(href.startsWith('/') ? href : active.path.replace(/[^/]*$/, '') + href);
    window.api.readFile(p).then(f => openFiles([f])).catch(() => {});
  }
});
$('#preview').addEventListener('dblclick', () => setMode('edit'));

/* ---------- View modes ---------- */
function setMode(m) {
  if (!active) return;
  active.mode = m;
  document.body.classList.remove('mode-read', 'mode-edit', 'mode-split');
  document.body.classList.add('mode-' + m);
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  renderPreview();
  if (m !== 'read') { editor.layout(); editor.focus(); }
}
$$('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
const toggleMode = () => setMode(active.mode === 'read' ? 'edit' : 'read');

/* ---------- Tabs ---------- */
const isDirty = (t) => t.model.getAlternativeVersionId() !== t.savedVersion;

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  tabs.forEach(t => {
    const d = document.createElement('div');
    d.className = 'tab' + (t === active ? ' active' : '') + (isDirty(t) ? ' dirty' : '');
    d.innerHTML = '<span class="name"></span><span class="x">✕</span>';
    d.querySelector('.name').textContent = t.name;
    d.onclick = () => activate(t);
    d.querySelector('.x').onclick = (e) => { e.stopPropagation(); closeTab(t); };
    d.onauxclick = () => closeTab(t);
    box.appendChild(d);
  });
  $('#st-file').textContent = active ? (active.path || 'Not saved yet') : '';
  document.title = active ? active.name : 'NextReader';
}

function newTab({ path = null, name = 'Untitled.md', content = '', mode } = {}) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const model = monaco.editor.createModel(content, LANG_BY_EXT[ext] || 'plaintext');
  const welcome = !path && !content;
  const t = { path, name, model, welcome, savedVersion: model.getAlternativeVersionId(), mode: mode || (welcome ? 'read' : path ? settings.defaultMode : 'edit') };
  model.onDidChangeContent(() => { renderTabs(); if (t === active) schedulePreview(); });
  tabs.push(t); activate(t); return t;
}

function activate(t) {
  active = t; editor.setModel(t.model);
  renderTabs(); setMode(t.mode);
}

async function closeTab(t) {
  if (isDirty(t)) {
    const r = await window.api.confirmDiscard(t.name);
    if (r === 'cancel') return;
    if (r === 'save' && !(await save(t))) return;
  }
  const i = tabs.indexOf(t); tabs.splice(i, 1); t.model.dispose();
  if (!tabs.length) newTab(); else if (t === active) activate(tabs[Math.min(i, tabs.length - 1)]); else renderTabs();
}

async function save(t = active, as = false) {
  if (!t) return false;
  if (t.path && !as) await window.api.writeFile(t.path, t.model.getValue());
  else {
    const r = await window.api.saveAs(t.name, t.model.getValue()); if (!r) return false;
    t.path = r.path; t.name = r.name;
    monaco.editor.setModelLanguage(t.model, LANG_BY_EXT[r.name.split('.').pop().toLowerCase()] || 'plaintext');
  }
  t.savedVersion = t.model.getAlternativeVersionId(); renderTabs(); return true;
}

function openFiles(files) {
  files.forEach(f => {
    const ex = tabs.find(t => t.path === f.path);
    if (ex) return activate(ex);
    const blank = tabs.length === 1 && !tabs[0].path && !isDirty(tabs[0]) ? tabs[0] : null;
    newTab(f);
    if (blank) { tabs.splice(tabs.indexOf(blank), 1); blank.model.dispose(); renderTabs(); }
  });
}

/* ---------- Sidebar ---------- */
async function buildTree(dir, container, depth = 0) {
  const items = await window.api.listDir(dir);
  items.forEach(it => {
    const n = document.createElement('div');
    n.className = 'node ' + (it.dir ? 'dir' : 'file');
    n.textContent = it.name; n.title = it.path; n.style.paddingLeft = (8 + depth * 14) + 'px';
    container.appendChild(n);
    if (it.dir) {
      const sub = document.createElement('div'); sub.hidden = true; container.appendChild(sub);
      let loaded = false;
      n.onclick = async () => {
        n.classList.toggle('open'); sub.hidden = !sub.hidden;
        if (!loaded) { loaded = true; await buildTree(it.path, sub, depth + 1); }
      };
    } else n.onclick = async () => openFiles([await window.api.readFile(it.path)]);
  });
}
async function openFolder(dir) {
  $('#side-head').textContent = dir.split('/').pop();
  const tree = $('#tree'); tree.innerHTML = '';
  document.body.classList.remove('no-sidebar');
  await buildTree(dir, tree);
}
$('#btn-newtab').onclick = () => newTab();
const toggleSidebar = () => document.body.classList.toggle('no-sidebar');
$('#btn-sidebar').onclick = toggleSidebar;

/* ---------- Drag & drop ---------- */
let dragDepth = 0;
const dropzone = $('#dropzone');
const hasFiles = (e) => e.dataTransfer && e.dataTransfer.types.includes('Files');
// Capture on window and stop propagation so the editor never does work for file drags.
const onDrag = (fn) => (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); fn(e); };
window.addEventListener('dragenter', onDrag(() => { dragDepth++; dropzone.hidden = false; }), true);
window.addEventListener('dragover', onDrag((e) => { e.dataTransfer.dropEffect = 'copy'; }), true);
window.addEventListener('dragleave', onDrag(() => { if (--dragDepth <= 0) { dragDepth = 0; dropzone.hidden = true; } }), true);
window.addEventListener('drop', onDrag(async (e) => {
  dragDepth = 0; dropzone.hidden = true;
  const dropped = [...e.dataTransfer.files];
  const folders = [], files = [];
  // Read in the renderer: no round trip to the main process for plain files.
  await Promise.all(dropped.map(async (f) => {
    const path = window.api.pathFor(f);
    if (!path) return;
    try {
      const content = await f.text();
      if (!content.includes('\u0000')) files.push({ path, name: f.name, content });
    } catch { folders.push(path); }   // directories cannot be read as text
  }));
  if (files.length) openFiles(files);
  if (folders.length) window.api.openPaths(folders);
}), true);

/* ---------- Boot ---------- */
window.MonacoEnvironment = {
  getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
    `self.MonacoEnvironment={baseUrl:'${base}'};importScripts('${base}vs/base/worker/workerMain.js');`)
};
require.config({ paths: { vs: base + 'vs' } });
require(['vs/editor/editor.main'], (m) => {
  monaco = m;
  const common = (bg, fg, ln, line, sel) => ({ 'editor.background': bg, 'editor.foreground': fg, 'editorLineNumber.foreground': ln,
    'editorLineNumber.activeForeground': fg, 'editor.lineHighlightBackground': line, 'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': sel, 'editorGutter.background': bg });
  monaco.editor.defineTheme('nr-light', { base: 'vs', inherit: true, rules: [], colors: common('#ffffff', '#1f2328', '#aeb4bd', '#f6f7f9', '#cfe0ff') });
  monaco.editor.defineTheme('nr-dark', { base: 'vs-dark', inherit: true, rules: [], colors: common('#1c1d20', '#dfe1e5', '#5d6169', '#25262a', '#334a73') });
  monaco.editor.defineTheme('nr-soft', { base: 'vs', inherit: true, colors: common('#faf6ef', '#3b3630', '#c2b8a4', '#f3ecdf', '#ecd3bf'),
    rules: [{ token: 'keyword', foreground: 'b4492b' }, { token: 'string', foreground: '5f7a3a' }, { token: 'comment', foreground: 'a09580' },
      { token: 'number', foreground: '8a5a1f' }, { token: 'type', foreground: '2f6f7e' }, { token: 'tag', foreground: 'b4492b' },
      { token: 'keyword.md', foreground: 'c0572f' }, { token: 'string.link.md', foreground: '2f6f7e' }] });

  editor = monaco.editor.create($('#editor'), {
    automaticLayout: true, minimap: { enabled: false }, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    scrollBeyondLastLine: false, padding: { top: 16 }, renderWhitespace: 'selection', smoothScrolling: true,
    renderLineHighlight: 'line', dropIntoEditor: { enabled: false }, lineNumbersMinChars: 3, folding: false,
  });
  editor.onDidChangeCursorPosition(e => { $('#st-pos').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`; });

  buildCards(); applySettings();
  newTab();

  const api = window.api;
  api.on('files-opened', openFiles);
  api.on('folder-opened', openFolder);
  api.on('cmd-new', () => newTab());
  api.on('cmd-save', () => save());
  api.on('cmd-save-as', () => save(active, true));
  api.on('cmd-close-tab', () => active && closeTab(active));
  api.on('cmd-mode', (m) => setMode(m));
  api.on('cmd-toggle-mode', toggleMode);
  api.on('cmd-sidebar', toggleSidebar);
  api.on('cmd-settings', openSettings);
  api.on('cmd-find', () => { if (active.mode === 'read') setMode('edit'); editor.focus(); editor.getAction('actions.find').run(); });
});
