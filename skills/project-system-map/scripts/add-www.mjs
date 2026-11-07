// Puts a What / How / Why card row under every diagram figure in pages/*.html, from www-data.mjs.
// Idempotent: a row it wrote before (<div class="www" data-www="name">) is replaced, not doubled.
// A figure is <div class="figure" data-map="name"> ... </div> (see references/page-writing.md).
//   node add-www.mjs
import fs from 'node:fs';
import path from 'node:path';
import { WORK, load, listFiles, pick, esc, elementEnd } from './lib.mjs';

const www = await load('www-data.mjs');
const maps = await load('map-data.mjs');
let rows = 0;
const missing = [];

function row(name) {
  const w = www[name];
  const card = (title, t) => `<div><h4>${title}</h4><p class="ko" lang="ko">${esc(pick(t, 'ko'))}</p><p class="en" lang="en">${esc(pick(t, 'en'))}</p></div>`;
  return `<div class="www" data-www="${name}">\n    ${card('What', w.what)}\n    ${card('How', w.how)}\n    ${card('Why', w.why)}\n  </div>`;
}

for (const file of listFiles(path.join(WORK, 'pages'), '.html')) {
  let html = fs.readFileSync(file, 'utf8');
  // drop rows written earlier
  let i;
  while ((i = html.search(/<div class="www" data-www="/)) >= 0) {
    const end = elementEnd(html, i);
    if (end < 0) break;
    html = html.slice(0, i).replace(/\s*$/, '') + html.slice(end);
  }
  const re = /<div class="figure" data-map="([^"]+)"/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    const end = elementEnd(html, m.index);
    if (end < 0) { console.error(`${path.basename(file)}: figure ${m[1]} is not closed`); process.exitCode = 1; continue; }
    const name = m[1];
    if (!maps[name]) { console.error(`${path.basename(file)}: figure names unknown diagram "${name}"`); process.exitCode = 1; }
    out += html.slice(last, end);
    if (www[name]) { out += '\n\n  ' + row(name); rows++; } else missing.push(name);
    last = end;
    re.lastIndex = end;
  }
  out += html.slice(last);
  fs.writeFileSync(file, out);
}
if (missing.length) { console.error(`no www-data entry for: ${missing.join(', ')}`); process.exitCode = 1; }
console.log(`${rows} What / How / Why rows in place`);
