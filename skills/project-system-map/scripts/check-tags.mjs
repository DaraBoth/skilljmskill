// Checks that every non-void element is closed and nested properly in out/index.html,
// out/diagrams/*.html and pages/*.html. Script and style bodies and comments are skipped.
//   node check-tags.mjs
import fs from 'node:fs';
import path from 'node:path';
import { WORK, OUT, listFiles } from './lib.mjs';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// Elements HTML lets you leave open; we still want them closed, but do not cascade errors from them.
const files = [path.join(OUT, 'index.html'), ...listFiles(path.join(OUT, 'diagrams'), '.html'), ...listFiles(path.join(WORK, 'pages'), '.html')]
  .filter((f) => fs.existsSync(f));

let bad = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const html = src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (m, open, tag, body, close) => open + body.replace(/[^\n]/g, ' ') + close);
  const stack = [];
  const errors = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  const lineOf = (i) => html.slice(0, i).split('\n').length;
  let m;
  while ((m = re.exec(html))) {
    const [, closing, rawTag, , selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (!closing && (VOID.has(tag) || selfClose)) continue;
    if (tag === '!doctype') continue;
    if (!closing) { stack.push({ tag, line: lineOf(m.index) }); continue; }
    const top = stack[stack.length - 1];
    if (top && top.tag === tag) { stack.pop(); continue; }
    const at = stack.map((s) => s.tag).lastIndexOf(tag);
    if (at === -1) { errors.push(`line ${lineOf(m.index)}: </${tag}> closes nothing`); continue; }
    for (const s of stack.splice(at)) if (s.tag !== tag) errors.push(`line ${s.line}: <${s.tag}> is never closed (before </${tag}> on line ${lineOf(m.index)})`);
  }
  for (const s of stack) errors.push(`line ${s.line}: <${s.tag}> is never closed`);
  if (errors.length) {
    bad++;
    console.log(path.relative(WORK, file));
    errors.slice(0, 20).forEach((e) => console.log('  ' + e));
    if (errors.length > 20) console.log(`  ... ${errors.length - 20} more`);
  }
}
if (bad) { console.log(`${bad} of ${files.length} files have unbalanced tags`); process.exitCode = 1; }
else console.log(`all balanced (${files.length} files)`);
