/* Short code syntax:  /python ... /end   (block, or a single line)
   Written in the editor, rendered as a highlighted code block (or inline code if used mid-sentence). */
(function () {
  const LANGS = 'python|py|sql|javascript|js|typescript|ts|json|html|css|bash|sh|shell|yaml|yml|java|cpp|csharp|cs|go|rust|rs|ruby|php|xml|kotlin|swift|powershell|markdown|md|c|r';
  const BLOCK = new RegExp('^[ \\t]*\\/(' + LANGS + ')[ \\t]*\\n?([\\s\\S]*?)\\n?[ \\t]*\\/end\\b[ \\t]*$', 'gim');
  const INLINE = new RegExp('\\/(' + LANGS + ')[ \\t]+([^\\n]*?)[ \\t]+\\/end\\b', 'gi');
  const PROTECTED = /(^```[\s\S]*?^```|^~~~[\s\S]*?^~~~|`[^`\n]*`)/gm;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ALIAS = { py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash', yml: 'yaml', md: 'markdown', cs: 'csharp', rs: 'rust' };

  function expandShortcuts(src, hl) {
    return src.split(PROTECTED).map((seg, i) => {
      if (i % 2) return seg; // existing code fence / inline code: leave untouched
      return seg
        .replace(BLOCK, (_, lang, code) => '\n```' + lang.toLowerCase() + '\n' + code.replace(/^\n+|\s+$/g, '') + '\n```\n')
        .replace(INLINE, (_, lang, code) => {
          const l = ALIAS[lang.toLowerCase()] || lang.toLowerCase();
          const html = hl && hl.getLanguage(l) ? hl.highlight(code, { language: l, ignoreIllegals: true }).value : esc(code);
          return `<code class="hljs">${html}</code>`;
        });
    }).join('');
  }
  if (typeof module !== 'undefined') module.exports = { expandShortcuts };
  else window.expandShortcuts = expandShortcuts;
})();
