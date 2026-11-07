#!/usr/bin/env node
// Renders a throwaway, self-contained HTML page that explains code to a non-expert owner:
// big-picture cards (ELI5), a read-only code editor with line numbers and diff marks,
// numbered notes pinned to line ranges, and a double-check table.
//
//   node render.mjs <spec.json> [--out <file.html>] [--open]
//   node render.mjs --clean [<file.html>]      delete one page, or every page in the default folder
//
// Default output folder: <os tmpdir>/code-explainer/. Pages are review copies: delete after review.
// No dependencies. Code comes from git when a file has a "git" block, so line numbers are exact.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const DEFAULT_DIR = path.join(os.tmpdir(), 'code-explainer');
const args = process.argv.slice(2);

if (args[0] === '--clean') {
  const target = args[1];
  if (target) {
    if (!path.basename(target).startsWith('code-explainer-')) { console.error('refusing: not a code-explainer page'); process.exit(2); }
    fs.rmSync(target, { force: true });
    console.log('removed ' + target);
  } else if (fs.existsSync(DEFAULT_DIR)) {
    const files = fs.readdirSync(DEFAULT_DIR).filter((f) => f.startsWith('code-explainer-') && f.endsWith('.html'));
    for (const f of files) fs.rmSync(path.join(DEFAULT_DIR, f), { force: true });
    console.log(`removed ${files.length} page(s) from ${DEFAULT_DIR}`);
  }
  process.exit(0);
}

const specPath = args.find((a) => !a.startsWith('--'));
if (!specPath) { console.error('usage: node render.mjs <spec.json> [--out file.html] [--open] | --clean [file]'); process.exit(2); }
const outIdx = args.indexOf('--out');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// tiny inline markdown: `code`, **bold**, line breaks
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const slug = (s) => String(s || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'page';
const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function loadFile(f) {
  if (!f.git) {
    const lines = String(f.code ?? '').replace(/\r\n/g, '\n').split('\n');
    const start = f.startLine || 1;
    return { lines: lines.map((t, i) => ({ n: start + i, text: t, kind: (f.added || []).includes(start + i) ? 'add' : 'ctx' }))
      .flatMap((l) => [...(f.removed || []).filter((r) => r.after === l.n - 1).map((r) => ({ n: null, text: r.text, kind: 'del' })), l]) };
  }
  const { repo, rev, path: p, from = 1, to, base } = f.git;
  const all = git(repo, 'show', `${rev}:${p}`).replace(/\r\n/g, '\n').split('\n');
  if (all[all.length - 1] === '') all.pop();
  const end = Math.min(to || all.length, all.length);
  const added = new Set();
  const removedAfter = new Map(); // new-line number after which removed lines appear
  if (base) {
    const diff = git(repo, 'diff', '-U0', base, rev, '--', p).split('\n');
    let newLine = 0;
    for (const line of diff) {
      const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (h) { newLine = Number(h[1]); if (h[2] === '0') newLine += 1; continue; }
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) { added.add(newLine); newLine += 1; }
      else if (line.startsWith('-')) { const k = newLine - 1; if (!removedAfter.has(k)) removedAfter.set(k, []); removedAfter.get(k).push(line.slice(1)); }
    }
  }
  const out = [];
  for (let n = from; n <= end; n += 1) {
    for (const t of removedAfter.get(n - 1) || []) out.push({ n: null, text: t, kind: 'del' });
    out.push({ n, text: all[n - 1], kind: added.has(n) ? 'add' : 'ctx' });
  }
  return { lines: out, total: all.length };
}

// ---------------------------------------------------------------- highlighter (C-like: js, ts, java, css, json)
const KW = new Set(('abstract async await boolean break case catch class const continue default do else enum export extends false final finally for function if implements import in instanceof interface let new null private protected public return static super switch this throw true try typeof undefined var void while yield of from as').split(' '));
function highlight(lines) {
  let inBlock = false; let inTpl = false;
  return lines.map(({ text }) => {
    let s = text; let out = ''; let i = 0;
    const push = (cls, t) => { out += cls ? `<span class="t-${cls}">${esc(t)}</span>` : esc(t); };
    while (i < s.length) {
      if (inBlock) { const e = s.indexOf('*/', i); const stop = e < 0 ? s.length : e + 2; push('com', s.slice(i, stop)); i = stop; if (e >= 0) inBlock = false; continue; }
      if (inTpl) {
        let j = i; while (j < s.length && s[j] !== '`') { if (s[j] === '\\') j += 1; j += 1; }
        push('str', s.slice(i, Math.min(j + 1, s.length))); i = j + 1; if (j < s.length) inTpl = false; continue;
      }
      const c = s[i]; const rest = s.slice(i);
      if (rest.startsWith('//')) { push('com', rest); break; }
      if (rest.startsWith('/*')) { inBlock = true; continue; }
      if (c === '`') { inTpl = true; push('str', '`'); i += 1; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1; while (j < s.length && s[j] !== c) { if (s[j] === '\\') j += 1; j += 1; }
        push('str', s.slice(i, j + 1)); i = j + 1; continue;
      }
      const num = rest.match(/^\d[\d._]*/); if (num && !/[\w$]/.test(s[i - 1] || '')) { push('num', num[0]); i += num[0].length; continue; }
      const word = rest.match(/^[A-Za-z_$][\w$]*/);
      if (word) {
        const w = word[0]; const after = s.slice(i + w.length);
        if (KW.has(w)) push('kw', w); else if (/^\s*\(/.test(after)) push('fn', w); else if (/^[A-Z]/.test(w)) push('type', w); else push('', w);
        i += w.length; continue;
      }
      push(/[{}()[\];,.]/.test(c) ? 'pun' : (/[=+\-*/%!<>&|?:]/.test(c) ? 'op' : ''), c); i += 1;
    }
    return out || ' ';
  });
}

// ---------------------------------------------------------------- build
const meta = spec.meta || {};
const files = (spec.files || []).map((f, fi) => {
  const loaded = loadFile(f);
  const html = highlight(loaded.lines);
  return { ...f, fi, ...loaded, html };
});
const notes = (spec.notes || []).map((n, i) => ({ ...n, id: i + 1, fi: typeof n.file === 'number' ? n.file : Math.max(0, files.findIndex((f) => f.path === n.file || f.git?.path === n.file)) }));
const notesByStart = new Map();
for (const n of notes) { const k = `${n.fi}:${n.lines[0]}`; if (!notesByStart.has(k)) notesByStart.set(k, []); notesByStart.get(k).push(n.id); }

const kindLabel = { what: 'What it does', why: 'Why', risk: 'Watch out', check: 'Checked', fix: 'The fix' };
const statusLabel = { pass: 'Pass', warn: 'Note', fail: 'Fail' };

const isChanged = (f) => f.lines.some((l) => l.kind !== 'ctx');
// A changed file shows only the changed lines plus `context` lines around them (default 3);
// the rest is hidden behind a "show all" button. Unchanged files go in a closed Background section.
const renderPanel = (f) => {
  const display = f.path || f.git?.path || `file ${f.fi + 1}`;
  const changedIdx = f.lines.map((l, i) => (l.kind !== 'ctx' ? i : -1)).filter((i) => i >= 0);
  const ctxN = f.context ?? 3;
  const near = (i) => !changedIdx.length || changedIdx.some((c) => Math.abs(c - i) <= ctxN);
  const hiddenCount = f.lines.filter((_, i) => !near(i)).length;
  const rows = f.lines.map((l, i) => {
    const pins = l.n != null ? (notesByStart.get(`${f.fi}:${l.n}`) || []) : [];
    const mark = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : '';
    return `<tr class="ln ${l.kind}${near(i) ? '' : ' far'}" data-f="${f.fi}" data-n="${l.n ?? ''}"><td class="num">${l.n ?? ''}</td><td class="mark">${mark}</td><td class="pin">${pins.map((p) => `<a class="badge" href="#note-${p}" data-note="${p}">${p}</a>`).join('')}</td><td class="src"><pre>${f.html[i]}</pre></td></tr>`;
  }).join('');
  const changed = isChanged(f);
  const addN = f.lines.filter((l) => l.kind === 'add').length;
  const delN = f.lines.filter((l) => l.kind === 'del').length;
  const status = changed
    ? `<div class="fstatus changed">CHANGED IN THIS FIX: ${(() => {
        const added = f.lines.filter((l) => l.kind === 'add');
        const blank = added.filter((l) => !l.text.trim()).length;
        const comment = added.filter((l) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(l.text)).length;
        const code = added.length - blank - comment;
        const parts = [`${code} line(s) of code`, comment && `${comment} comment`, blank && `${blank} blank`].filter(Boolean).join(', ');
        return `${parts} added${delN ? `, ${delN} removed` : ''}`;
      })()}. Green + is new${delN ? ', red - is removed' : ''}.</div>`
    : '<div class="fstatus context">NOT CHANGED: shown only to explain the fix. Nothing in this file was edited.</div>';
  const where = f.git ? `${esc(f.git.rev)}${f.git.base ? ` vs ${esc(f.git.base)}` : ''}` : '';
  const shown = f.lines.filter((l, i) => l.n && near(i));
  const range = shown.length ? `showing lines ${shown[0].n} to ${shown[shown.length - 1].n}${f.total ? ` of ${f.total}` : ''}` : '';
  return `<div class="editor${changed ? '' : ' ctxonly'}" id="file-${f.fi}">
    ${status}
    <div class="tabbar"><span class="tab">${esc(path.basename(display))}</span><span class="tabpath">${esc(display)}</span></div>
    <div class="infobar"><span>${esc(f.language || path.extname(display).slice(1) || 'text')}</span><span>${range}</span><span>${where}</span>${f.added?.length || f.lines.some((l) => l.kind !== 'ctx') ? '<span class="legend"><i class="lg add"></i>added <i class="lg del"></i>removed</span>' : ''}</div>
    <div class="scroll"><table class="code">${rows}</table></div>
    ${hiddenCount ? `<button class="more" type="button">Show the ${hiddenCount} lines around it (not changed)</button>` : ''}
  </div>`;
};
const changedFiles = files.filter(isChanged);
const contextFiles = files.filter((f) => !isChanged(f));
const noteCard = (n) => `<article class="note k-${esc(n.kind || 'what')}" id="note-${n.id}" data-note="${n.id}" data-f="${n.fi}" data-a="${n.lines[0]}" data-b="${n.lines[1] ?? n.lines[0]}">
  <header><span class="badge big">${n.id}</span><span class="kind">${esc(kindLabel[n.kind] || 'Note')}</span><span class="lines">line ${n.lines[0]}${n.lines[1] && n.lines[1] !== n.lines[0] ? ` to ${n.lines[1]}` : ''}</span></header>
  <h4>${md(n.title)}</h4><p>${md(n.body)}</p></article>`;
const changedFi = new Set(changedFiles.map((f) => f.fi));
const codePanels = (changedFiles.length ? changedFiles : files).map(renderPanel).join('');
const noteCards = notes.filter((n) => !changedFiles.length || changedFi.has(n.fi)).map(noteCard).join('');
const background = changedFiles.length && contextFiles.length
  ? contextFiles.map((f) => `<details class="bg"><summary>Background, not changed: ${esc(path.basename(f.path || f.git?.path || ''))} (click to open)</summary>
      <div class="bgbody">${renderPanel(f)}<div class="bgnotes">${notes.filter((n) => n.fi === f.fi).map(noteCard).join('')}</div></div></details>`).join('')
  : '';

// ELI5 style check: big pictures, few words. Warn, do not fail.
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
(spec.bigPicture || []).forEach((c, i) => {
  if (!c.svg) console.warn(`warn: bigPicture ${i + 1} "${c.title}" has no svg picture (ELI5 = big pictures)`);
  if (words(c.text) > 30) console.warn(`warn: bigPicture ${i + 1} text is ${words(c.text)} words; keep it under 30`);
});
(spec.notes || []).forEach((n, i) => { if (words(n.body) > 45) console.warn(`warn: note ${i + 1} is ${words(n.body)} words; keep it under 45`); });

const cards = (spec.bigPicture || []).map((c, i) => `<div class="card${c.svg ? ' haspic' : ''}">${c.svg ? `<div class="pic">${c.svg}</div>` : ''}<div class="words"><div class="cnum">Step ${i + 1}</div><h3>${md(c.title)}</h3><p>${md(c.text)}</p></div></div>`).join('');
const checks = (spec.checks || []).map((c) => `<tr><td><span class="st ${esc(c.status)}">${esc(statusLabel[c.status] || c.status)}</span></td><td>${md(c.label)}</td><td>${md(c.detail)}</td></tr>`).join('');
// Proof media: embedded as data URIs (self-contained page) up to EMBED_MAX; bigger files are linked.
const EMBED_MAX = 30 * 1024 * 1024;
const MIME = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const proof = (spec.proof || []).map((m) => {
  const ext = path.extname(m.path).toLowerCase();
  const mime = MIME[ext];
  if (!mime || !fs.existsSync(m.path)) { console.warn(`warn: proof file missing or unknown type: ${m.path}`); return ''; }
  const size = fs.statSync(m.path).size;
  const src = size <= EMBED_MAX ? `data:${mime};base64,${fs.readFileSync(m.path).toString('base64')}` : 'file:///' + path.resolve(m.path).split(path.sep).join('/');
  const media = mime.startsWith('video/')
    ? `<video controls preload="metadata" src="${src}"></video>`
    : `<img alt="${esc(m.caption || '')}" src="${src}">`;
  const tag = m.label ? `<span class="ptag ${m.label === 'before' ? 'before' : 'after'}">${m.label === 'before' ? 'BEFORE: the bug' : 'AFTER: fixed'}</span>` : '';
  return `<figure class="proof">${tag}${media}<figcaption>${md(m.caption || '')}<span class="psrc">${esc(path.basename(m.path))}, ${Math.round(size / 1024)} KB${size > EMBED_MAX ? ', linked not embedded' : ''}</span></figcaption></figure>`;
}).join('');

const glossary = (spec.glossary || []).map((g) => `<dt>${md(g.term)}</dt><dd>${md(g.meaning)}</dd>`).join('');

const outFile = outIdx >= 0 ? args[outIdx + 1] : path.join(DEFAULT_DIR, `code-explainer-${slug(meta.slug || meta.title)}.html`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const scriptPath = path.resolve(process.argv[1]).split(path.sep).join('/');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title || 'Code explainer')}</title>
<style>
:root{--bg:#f5f4f8;--paper:#fff;--ink:#1c1b22;--soft:#6a6878;--line:#e4e2ec;--accent:#5b4bdb;--ed:#1e1e1e;--edbar:#252526;--edtab:#2d2d2d;--ednum:#858585;--add:#1f3a24;--addm:#4ec96b;--del:#3f1d1f;--delm:#f0626c;--hl:#3a3d6b}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:15.5px/1.6 "Segoe UI",Roboto,"Helvetica Neue",sans-serif}
.wrap{max-width:1440px;margin:0 auto;padding:28px 28px 60px}
.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:22px}
h1{font-size:28px;margin:0 0 4px;letter-spacing:-.01em}.sub{color:var(--soft);margin:0}
.meta{display:flex;gap:8px;flex-wrap:wrap}.chip{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13px;color:var(--soft)}.chip b{color:var(--ink);font-weight:600}
h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:30px 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(520px,1fr));gap:16px}
@media(max-width:600px){.cards{grid-template-columns:1fr}}
.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:20px 22px;display:flex;gap:22px;align-items:center}
.card .pic{flex:0 0 auto;width:260px}.card .pic svg{width:100%;height:auto;display:block}
.card .words{flex:1 1 auto}
.cnum{font:700 12px/1 "Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.card h3{margin:0 0 6px;font-size:21px;line-height:1.3}.card p{margin:0;color:#3d3b49;font-size:16.5px}
.main{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:20px;align-items:start}
@media(max-width:1000px){.main{grid-template-columns:1fr}}
.editor{background:var(--ed);border-radius:12px;overflow:hidden;box-shadow:0 8px 28px #0000002a;margin-bottom:18px}
.fstatus{font:700 13px/1.4 "Segoe UI",sans-serif;letter-spacing:.02em;padding:9px 14px}
.fstatus.changed{background:#1f7a3f;color:#fff}.fstatus.context{background:#4a4a52;color:#e6e6ea}
.editor.ctxonly{opacity:.92}
.editor:not(.expanded) tr.far{display:none}
.more{display:block;width:100%;background:#2a2a2e;color:#b9b9c4;border:0;border-top:1px solid #000;font:13px "Segoe UI",sans-serif;padding:8px;cursor:pointer}.more:hover{color:#fff}
.proofs{display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:16px}
@media(max-width:600px){.proofs{grid-template-columns:1fr}}
figure.proof{margin:0;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px;position:relative}
figure.proof video,figure.proof img{width:100%;border-radius:8px;display:block;background:#000}
figure.proof figcaption{margin-top:10px;color:#3d3b49;font-size:15px}
.psrc{display:block;color:var(--soft);font:12px ui-monospace,monospace;margin-top:4px}
.ptag{position:absolute;top:22px;left:22px;z-index:1;font:700 12px/1 "Segoe UI",sans-serif;letter-spacing:.06em;padding:6px 10px;border-radius:6px;color:#fff}
.ptag.before{background:#c9353c}.ptag.after{background:#1f7a3f}
details.bg{background:var(--paper);border:1px solid var(--line);border-radius:12px;margin-bottom:12px}
details.bg summary{cursor:pointer;padding:12px 16px;font-weight:600;color:var(--soft)}
.bgbody{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);gap:18px;padding:0 16px 16px}
@media(max-width:1000px){.bgbody{grid-template-columns:1fr}}
.tabbar{display:flex;align-items:center;gap:14px;background:var(--edbar);padding:0 12px;height:38px}
.tab{background:var(--ed);color:#fff;font:13px/38px "Segoe UI",sans-serif;padding:0 14px;border-top:2px solid var(--accent)}
.tabpath{color:#9d9d9d;font:12px ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.infobar{display:flex;gap:16px;flex-wrap:wrap;background:var(--edtab);color:#a8a8a8;font:12px ui-monospace,Consolas,monospace;padding:6px 14px;border-bottom:1px solid #000}
.legend{margin-left:auto}.lg{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:-1px}.lg.add{background:var(--addm)}.lg.del{background:var(--delm)}
.scroll{overflow:auto;max-height:78vh}
table.code{border-collapse:collapse;width:100%;font:13.5px/1.6 "Cascadia Code","JetBrains Mono",Consolas,ui-monospace,monospace;color:#d4d4d4}
.ln td{padding:0;vertical-align:top}.num{color:var(--ednum);text-align:right;padding:0 10px 0 14px!important;user-select:none;width:1%;white-space:nowrap}
.mark{width:16px;text-align:center;user-select:none;font-weight:700}.pin{width:1%;white-space:nowrap;padding-right:6px!important}
.src pre{margin:0;padding:0 18px 0 6px;white-space:pre;font:inherit}
.ln.add{background:var(--add)}.ln.add .mark{color:var(--addm)}.ln.del{background:var(--del)}.ln.del .mark{color:var(--delm)}.ln.del .src{opacity:.8}
.ln.hl{background:var(--hl)!important;box-shadow:inset 3px 0 0 #8f83ff}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:10px;background:var(--accent);color:#fff;font:700 11px/1 "Segoe UI",sans-serif;text-decoration:none;padding:0 5px;margin-right:2px}
.badge.big{min-width:24px;height:24px;font-size:12.5px;border-radius:12px}
.t-kw{color:#c586c0}.t-str{color:#ce9178}.t-com{color:#6a9955;font-style:italic}.t-num{color:#b5cea8}.t-fn{color:#dcdcaa}.t-type{color:#4ec9b0}.t-op{color:#d4d4d4}.t-pun{color:#a0a0a0}
.notes{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto;padding-right:4px}
.note{background:var(--paper);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 16px;margin-bottom:12px;cursor:pointer;transition:box-shadow .15s,border-color .15s}
.note:hover,.note.on{box-shadow:0 4px 18px #5b4bdb26;border-color:#cfc9f6}
.note header{display:flex;align-items:center;gap:10px;margin-bottom:4px}.kind{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--soft)}.lines{margin-left:auto;font:12px ui-monospace,monospace;color:var(--soft)}
.note h4{margin:2px 0 4px;font-size:15.5px}.note p{margin:0;color:#3d3b49;font-size:14.5px}
.k-fix{border-left-color:#2f9e62}.k-risk{border-left-color:#e0912f}.k-why{border-left-color:#3f8fd8}.k-check{border-left-color:#8a8799}
code{font:12.5px ui-monospace,Consolas,monospace;background:#efedf7;border-radius:4px;padding:1px 5px}
table.checks{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.checks td,.checks th{padding:10px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.checks th{font-size:12px;color:var(--soft);text-transform:uppercase;letter-spacing:.06em}
.st{display:inline-block;border-radius:6px;padding:2px 9px;font-size:12px;font-weight:700}.st.pass{background:#e3f6ea;color:#1e7a46}.st.warn{background:#fff1dc;color:#9a5b00}.st.fail{background:#fde4e5;color:#b3262e}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:0}dt{font-weight:600}dd{margin:0;color:#3d3b49}
.foot{margin-top:34px;padding:14px 18px;border:1px dashed #cfcbe0;border-radius:10px;color:var(--soft);font-size:13.5px;background:#fbfaff}
</style></head><body><div class="wrap">
<div class="top"><div><h1>${md(meta.title || 'Code explainer')}</h1><p class="sub">${md(meta.subtitle || '')}</p></div>
<div class="meta">${['repo', 'branch', 'commit', 'date'].filter((k) => meta[k]).map((k) => `<span class="chip">${k} <b>${esc(meta[k])}</b></span>`).join('')}</div></div>
${cards ? `<h2>The big picture</h2><div class="cards">${cards}</div>` : ''}
<h2>${changedFiles.length ? 'What the change is' : 'The code, line by line'}</h2>
<div class="main"><div>${codePanels}</div><aside class="notes">${noteCards}</aside></div>
${proof ? `<h2>Proof it works</h2><div class="proofs">${proof}</div>` : ''}
${background ? `<h2>Background (optional, nothing here was changed)</h2>${background}` : ''}
${checks ? `<h2>Double check</h2><table class="checks"><tr><th>Result</th><th>What was checked</th><th>Evidence</th></tr>${checks}</table>` : ''}
${glossary ? `<h2>Words used</h2><dl>${glossary}</dl>` : ''}
<div class="foot">Temporary review page, made ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))}. It is a copy for reading, not the source. Delete it after review: <code>node "${esc(scriptPath)}" --clean "${esc(outFile.split(path.sep).join('/'))}"</code></div>
</div>
<script>
const rows = (f, a, b) => [...document.querySelectorAll('tr.ln[data-f="' + f + '"]')].filter(r => r.dataset.n && +r.dataset.n >= a && +r.dataset.n <= b);
function focusNote(id, scroll) {
  document.querySelectorAll('.ln.hl').forEach(r => r.classList.remove('hl'));
  document.querySelectorAll('.note.on').forEach(n => n.classList.remove('on'));
  const n = document.getElementById('note-' + id); if (!n) return;
  n.classList.add('on');
  const d = n.closest('details'); if (d) d.open = true;
  const ed = document.getElementById('file-' + n.dataset.f);
  if (ed && rows(n.dataset.f, +n.dataset.a, +n.dataset.b).some(r => r.classList.contains('far'))) ed.classList.add('expanded');
  const rs = rows(n.dataset.f, +n.dataset.a, +n.dataset.b); rs.forEach(r => r.classList.add('hl'));
  if (scroll && rs[0]) rs[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (!scroll) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
document.querySelectorAll('.more').forEach(b => b.addEventListener('click', () => {
  const ed = b.closest('.editor'); ed.classList.toggle('expanded');
  b.textContent = ed.classList.contains('expanded') ? 'Hide the lines that did not change' : b.dataset.label;
}));
document.querySelectorAll('.more').forEach(b => { b.dataset.label = b.textContent; });
document.querySelectorAll('.note').forEach(n => n.addEventListener('click', () => focusNote(n.dataset.note, true)));
document.querySelectorAll('a.badge').forEach(a => a.addEventListener('click', e => { e.preventDefault(); focusNote(a.dataset.note, false); }));
</script></body></html>`;

fs.writeFileSync(outFile, html);
console.log(outFile);

if (args.includes('--open')) {
  const url = 'file:///' + path.resolve(outFile).split(path.sep).join('/');
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', 'chrome', url], { detached: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}
