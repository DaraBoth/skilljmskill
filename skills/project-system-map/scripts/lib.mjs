// Shared helpers for the system map scripts. Every script runs from the work folder.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const LANGS = ['ko', 'en'];
export const WORK = process.cwd();
export const OUT = path.join(WORK, 'out');

export async function load(file, fallback) {
  const p = path.join(WORK, file);
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing ${file} in ${WORK}`);
  }
  const mod = await import(pathToFileURL(p).href + '?t=' + Date.now());
  return mod.default;
}

export async function loadAll() {
  const config = await load('map-config.mjs');
  const maps = await load('map-data.mjs');
  const details = await load('details.mjs', {});
  const explain = await load('map-explain.mjs', {});
  const www = await load('www-data.mjs', {});
  return { config, maps, details, explain, www };
}

// A text is a string (same in both languages) or { ko, en }.
export function pick(t, lang) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return t[lang] ?? '';
}
export function bothLangs(t) {
  return LANGS.every((l) => pick(t, l).trim() !== '');
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function ko(t) { return `<span class="ko" lang="ko">${esc(pick(t, 'ko'))}</span>`; }
export function en(t) { return `<span class="en" lang="en">${esc(pick(t, 'en'))}</span>`; }
export function both(t) { return ko(t) + en(t); }

// JSON that is safe inside <script>: "<" never appears raw, so "</script>" cannot close the tag.
export function scriptJson(v) {
  const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029), BS = String.fromCharCode(92);
  return JSON.stringify(v).split('<').join(BS + 'u003c').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');
}

// ---------- citations ----------
// "path/to/file.ts:12", "path/to/file.ts:12-30", or { cite: "path:line", text: { ko, en } }
export function parseCite(c) {
  const raw = typeof c === 'string' ? c : c && c.cite;
  const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(String(raw || '').trim());
  if (!m) return { raw, bad: 'not in path:line form' };
  return { raw, path: m[1], from: +m[2], to: m[3] ? +m[3] : +m[2], text: typeof c === 'string' ? null : c.text };
}

export function citeHref(config, ci) {
  const base = config.linkBase ?? (config.repoUrl ? `${config.repoUrl.replace(/\/$/, '')}/blob/${config.rev}` : '');
  const frag = ci.to !== ci.from ? `#L${ci.from}-L${ci.to}` : `#L${ci.from}`;
  return (base ? base.replace(/\/$/, '') + '/' : '') + ci.path + frag;
}

export function citeName(ci) {
  return `${path.posix.basename(ci.path)}:${ci.from}${ci.to !== ci.from ? '-' + ci.to : ''}`;
}

export function srcList(config, list, lang) {
  return (list || []).map(parseCite).filter((ci) => !ci.bad).map((ci) => ({
    name: citeName(ci),
    path: ci.path,
    href: citeHref(config, ci),
    text: ci.text ? pick(ci.text, lang) : '',
  }));
}

// ---------- git ----------
export function repoDir(config) { return path.resolve(WORK, config.repoPath || '.'); }
export function git(config, args) {
  return execFileSync('git', ['-C', repoDir(config), ...args], {
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}
export function isWorktree(config) { return !config.rev || config.rev === 'WORKTREE'; }

const fileCache = new Map();
export function readAtRev(config, file) {
  if (fileCache.has(file)) return fileCache.get(file);
  let text = null;
  if (isWorktree(config)) {
    const p = path.resolve(repoDir(config), file);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) text = fs.readFileSync(p, 'utf8');
  } else {
    try { text = git(config, ['show', `${config.rev}:${file}`]); } catch { text = null; }
  }
  fileCache.set(file, text);
  return text;
}

// ---------- explanations ----------
// info: 'set.key' (an entry of details.mjs) or { ko, en } inline. map-explain.mjs fills gaps by 'diagram.item'.
export function resolveInfo(item, mapName, details, explain) {
  let info = item.info;
  let src = [...(item.src || [])];
  if (typeof info === 'string') {
    const [set, key] = info.split('.');
    const d = details && details[set] && details[set][key];
    info = d ? { ko: pick(d, 'ko') || (typeof d === 'string' ? d : ''), en: pick(d, 'en') || (typeof d === 'string' ? d : '') } : null;
    if (d && d.src) src = src.concat(d.src);
  }
  const fill = explain && explain[`${mapName}.${item.id}`];
  if (fill && (!info || !bothLangs(info))) {
    info = { ko: pick(info, 'ko') || pick(fill, 'ko'), en: pick(info, 'en') || pick(fill, 'en') };
    if (fill.src) src = src.concat(fill.src);
  }
  return { info: info || null, src };
}

// Every clickable item of a diagram: free nodes and groups that carry info, sequence actors and
// steps, lane nodes. Sections and edges are not clickable.
export function clickables(map) {
  const out = [];
  if (map.kind === 'free') {
    (map.groups || []).forEach((g) => { if (g.id && g.info !== undefined) out.push(g); });
    (map.nodes || []).forEach((n) => out.push(n));
  } else if (map.kind === 'sequence') {
    (map.actors || []).forEach((a) => out.push(a));
    let n = 0;
    (map.steps || []).forEach((s) => { if (!s.section) { n++; if (!s.id) s.id = 'm' + n; out.push(s); } });
  } else if (map.kind === 'lanes') {
    (map.nodes || []).forEach((n) => out.push(n));
  }
  return out;
}

// ---------- text measuring without a browser: close enough for layout ----------
function isWide(c) {
  return (c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3)
    || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef);
}
export function textWidth(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (isWide(c)) w += 0.94;
    else if (" ilIjf.,:;'|!()[]/".includes(ch)) w += 0.3;
    else if ('mwMW@%'.includes(ch)) w += 0.84;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else if (ch >= '0' && ch <= '9') w += 0.56;
    else w += 0.53;
  }
  return w * size * (bold ? 1.07 : 1);
}

export function wrap(s, max, size, bold, maxLines = 6) {
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let word of words) {
    while (textWidth(word, size, bold) > max && word.length > 1) {
      let i = 1;
      while (i < word.length - 1 && textWidth(word.slice(0, i + 1), size, bold) <= max) i++;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(word.slice(0, i));
      word = word.slice(i);
    }
    const next = cur ? cur + ' ' + word : word;
    if (!cur || textWidth(next, size, bold) <= max) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.$/, '…');
    return kept;
  }
  return lines;
}

// ---------- files ----------
export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
export function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => path.join(dir, f));
}

// Index just past the element that opens at `start`, counting nested tags of the same name.
export function elementEnd(html, start) {
  const m = /^<([a-zA-Z][\w-]*)/.exec(html.slice(start));
  if (!m) return -1;
  const re = new RegExp(`<(/?)${m[1]}(?=[\\s>/])[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  let x;
  while ((x = re.exec(html))) {
    if (x[0].endsWith('/>')) continue;
    depth += x[1] ? -1 : 1;
    if (depth === 0) return x.index + x[0].length;
  }
  return -1;
}

// Tab ids in sidebar order, from map-config groups.
export function tabList(config) {
  const tabs = [];
  (config.groups || []).forEach((g) => (g.tabs || []).forEach((t) => tabs.push({ ...t, group: g })));
  return tabs;
}
