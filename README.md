# NextReader

A fast, good-looking **Markdown reader and editor for macOS**, in the spirit of Notepad++.
Read `.md` files as clean rendered pages, edit them with a syntax-highlighted editor, and write code blocks with a short `/python … /end` syntax.

## Features

- **Read / Edit / Split views.** Files open in a distraction-free reading view. Switch to the editor, or see both side by side.
- **Syntax highlighting** for the main languages (Python, SQL, JavaScript, TypeScript, JSON, HTML, CSS, Bash, YAML, Java, C/C++, Go, Rust, Ruby, PHP, and more), both in the editor and in rendered code blocks.
- **Short code syntax:** type `/python`, your code, then `/end`.
- **Tabs** with a **+** button, unsaved-changes indicator and save prompts.
- **Folder sidebar** (appears when you open a folder).
- **Themes:** System, Light, Dark and a warm **Soft** theme. Reading font, text size, page width and editor options are in **Settings**.
- Renders GitHub-style tables, task lists, images (including relative paths) and links between `.md` files.
- Opens `.md`, `.markdown` and `.mdx` files from Finder once installed.

## Install (macOS, Apple Silicon)

1. Build the installer (see below), or download the `.dmg` if one is attached to a release.
2. Open the `.dmg` and drag **NextReader** into **Applications**.
3. The app is not signed with an Apple developer certificate. On first launch: right-click the app → **Open** → **Open**.
4. Optional: right-click any `.md` file → **Get Info** → **Open with: NextReader** → **Change All…**.

## Run from source

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/CCliff8/NextReader.git
cd NextReader
npm install
npm start                 # launch the app
npm start -- file.md      # launch and open a file
```

## Build the installer

```bash
npm run dist
```

The `.dmg` and the `.app` are created in `dist/`. The build targets the architecture of the machine it runs on (Apple Silicon by default).

## Using it

| Action | Shortcut |
| --- | --- |
| Open file / folder | ⌘O / ⇧⌘O |
| New tab | ⌘N or the **+** button |
| Save / Save As | ⌘S / ⇧⌘S |
| Close tab | ⌘W |
| Read / Edit / Split | ⌘1 / ⌘2 / ⌘3 |
| Toggle Read ↔ Edit | ⌘E (or double-click the page) |
| Toggle sidebar | ⌘B |
| Find | ⌘F |
| Settings | ⌘, |

### Short code syntax

````
/python print('Hello World') /end

/sql
SELECT name, total
FROM orders
WHERE total > 100;
/end
````

Supported names: `python` (`py`), `sql`, `javascript` (`js`), `typescript` (`ts`), `json`, `html`, `css`, `bash` (`sh`, `shell`), `yaml` (`yml`), `java`, `c`, `cpp`, `csharp` (`cs`), `go`, `rust` (`rs`), `ruby`, `php`, `xml`, `kotlin`, `swift`, `powershell`, `r`, `markdown` (`md`).
Normal fenced blocks (```` ```python ````) keep working. Paths like `/usr/bin` are never touched.

## Project layout

```
main.js          Electron main process: window, menus, file access
preload.js       Safe bridge between the app and the main process
renderer/        The interface (HTML, CSS, JS) and the /lang … /end converter
build/           App icon (SVG source, PNG and .icns)
```

Built with [Electron](https://www.electronjs.org), [Monaco Editor](https://microsoft.github.io/monaco-editor/), [marked](https://marked.js.org), [highlight.js](https://highlightjs.org) and [DOMPurify](https://github.com/cure53/DOMPurify).

## Roadmap

- Search across all files in a folder
- Colouring of `/lang … /end` blocks inside the editor
- Intel and Windows builds

## License

[MIT](LICENSE)
