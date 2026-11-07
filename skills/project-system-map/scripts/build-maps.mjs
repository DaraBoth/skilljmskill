// Renders every diagram in map-data.mjs to out/diagrams/<name>-map-<lang>.html, in the AWS
// architecture-diagram style: white canvas, official icons, soft rounded groups, a legend,
// a click panel on every box and step, zoom and drag.
//   node build-maps.mjs            all diagrams
//   node build-maps.mjs aws signin only these
import fs from 'node:fs';
import path from 'node:path';
import {
  LANGS, OUT, WORK, loadAll, pick, esc, scriptJson, resolveInfo, clickables, srcList,
  textWidth, wrap, ensureDir,
} from './lib.mjs';

const { config, maps, details, explain } = await loadAll();
const only = process.argv.slice(2);
const ICON_DIR = path.resolve(WORK, config.iconDir || 'dl-aws-icons/package/icons');

// ---------- icons ----------
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const FOLDER_RANK = ['architecture-service', 'resource', 'architecture-group', 'category'];
let iconIndex = null;
function indexIcons() {
  iconIndex = new Map();
  if (!fs.existsSync(ICON_DIR)) return;
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.svg')) {
        const key = norm(f.name.replace(/\.svg$/, ''));
        const rank = FOLDER_RANK.indexOf(path.basename(dir));
        const old = iconIndex.get(key);
        if (!old || (rank >= 0 && (old.rank < 0 || rank < old.rank))) iconIndex.set(key, { file: p, rank });
      }
    }
  };
  walk(ICON_DIR);
}
const iconCache = new Map();
const missingIcons = new Set();
function icon(name) {
  if (!name) return null;
  if (iconCache.has(name)) return iconCache.get(name);
  let file = null;
  const custom = config.icons && config.icons[name];
  if (custom) file = path.resolve(WORK, custom);
  else if (/[\\/]/.test(name)) file = path.join(ICON_DIR, name.replace(/\.svg$/, '') + '.svg');
  else {
    if (!iconIndex) indexIcons();
    const hit = iconIndex.get(norm(name));
    file = hit && hit.file;
  }
  if (!file || !fs.existsSync(file)) { missingIcons.add(name); iconCache.set(name, null); return null; }
  const svg = fs.readFileSync(file, 'utf8');
  const vb = (/viewBox="([^"]+)"/.exec(svg) || [])[1] || '0 0 48 48';
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/g, '');
  const color = ((/fill="(#[0-9a-fA-F]{6})"/.exec(svg) || [])[1] || '#232F3E').toUpperCase();
  const ic = { id: 'ic-' + norm(name), vb, inner, color };
  iconCache.set(name, ic);
  return ic;
}
function suggest(name) {
  if (!iconIndex) indexIcons();
  const n = norm(name);
  return [...iconIndex.keys()].filter((k) => k.includes(n) || n.includes(k)).slice(0, 6);
}

// ---------- shared pieces ----------
const MARKERS = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#545B64"/></marker>
<marker id="arrow-secret" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#DD344C"/></marker>
<marker id="arrow-pick" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0972D3"/></marker>`;

function defs(used) {
  const syms = [...used].map((n) => icon(n)).filter(Boolean)
    .map((ic) => `<symbol id="${ic.id}" viewBox="${ic.vb}">${ic.inner}</symbol>`);
  return `<defs>\n${MARKERS}\n${syms.join('\n')}\n</defs>`;
}
function useIcon(name, x, y, size, used) {
  const ic = icon(name);
  if (!ic) return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" fill="#7D8998"/>`;
  used.add(name);
  return `<use href="#${ic.id}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
}
function lines(cls, list, x, y, step, anchor) {
  return list.map((l, i) => `<text class="${cls}" x="${x}" y="${y + i * step}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(l)}</text>`).join('');
}
function edgeClass(e, base) {
  const c = ['edge'];
  if (base === 'main' || e.style === 'main') c.push('main');
  if (e.style === 'secret') c.push('secret');
  if (e.style === 'dashed' || e.dashed) c.push('dashed');
  if (e.arrow !== false) c.push('arrowed');
  return c.join(' ');
}
function marker(e) {
  if (e.arrow === false) return '';
  return ` marker-end="url(#${e.style === 'secret' ? 'arrow-secret' : 'arrow'})"`;
}
const r1 = (n) => Math.round(n * 10) / 10;
function pathD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + r1(p[0]) + ' ' + r1(p[1])).join(' '); }

// Point and direction at fraction t along a polyline.
function along(pts, t) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(len); total += len;
  }
  let want = total * t;
  for (let i = 0; i < segs.length; i++) {
    if (want <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, want / segs[i]) : 0;
      const a = pts[i], b = pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, horiz: Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) };
    }
    want -= segs[i];
  }
  return { x: pts[0][0], y: pts[0][1], horiz: true };
}
function edgeLabel(e, pts, lang) {
  const label = pick(e.label, lang);
  const label2 = pick(e.label2, lang);
  if (!label && !label2) return '';
  const p = along(pts, e.at ?? 0.5);
  let side = e.side || (p.horiz ? 'above' : 'right');
  let x = p.x, y = p.y, anchor = e.anchor || 'middle';
  if (side === 'above') { y -= 8; }
  else if (side === 'below') { y += 16; }
  else if (side === 'right') { x += 8; y += 4; anchor = e.anchor || 'start'; }
  else if (side === 'left') { x -= 8; y += 4; anchor = e.anchor || 'end'; }
  if (e.offset) { x += e.offset[0]; y += e.offset[1]; }
  let out = `<text class="elab" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(label)}</text>`;
  if (label2) out += `<text class="elab" x="${r1(x)}" y="${r1(y + (side === 'above' ? 24 : 14))}" text-anchor="${anchor}">${esc(label2)}</text>`;
  return out;
}
// Clip the segment from a box center toward `toward` at the box edge (plus a gap).
function clip(box, toward, gap = 4) {
  const [cx, cy] = [box.cx, box.cy];
  const dx = toward[0] - cx, dy = toward[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const hw = box.w / 2 + gap, hh = box.h / 2 + gap;
  const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * s, cy + dy * s];
}

// ---------- the page around a diagram ----------
const UI = {
  ko: { hint: '아이콘이나 단계를 누르면 설명이 나와요', tools: 'Ctrl + 휠로 확대, 끌어서 이동', fit: '맞춤', zin: '확대', zout: '축소', what: '하는 일', code: '코드 위치', close: '닫기', legend: '범례', call: '호출', callLine: '화살표가 받는 쪽을 가리켜요', secret: '비밀값', secretLine: '비밀값이나 키가 실린 요청이에요', dashed: '간접 또는 예정', dashedLine: '큐를 거치거나, 설정할 때만, 또는 아직 없어요', ref: '참조: 화살표가 가리키는 테이블의 행을 저장해요' },
  en: { hint: 'Click an icon or a step to see what it does', tools: 'Ctrl + wheel zooms, drag to move', fit: 'Fit', zin: 'Zoom in', zout: 'Zoom out', what: 'What it does', code: 'In the code', close: 'Close', legend: 'Legend', call: 'Call', callLine: 'the arrow points at the one called', secret: 'Secret', secretLine: 'the request carries a secret or key', dashed: 'Indirect or planned', dashedLine: 'through a queue, only when set, or not live yet', ref: 'Reference: stores a row id of the table the arrow points at' },
};

const CSS = `
  :root { --ink: #232F3E; --muted: #5F6B7A; --line: #545B64; --pick: #0972D3; --rule: #D5DBDB; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #fff; color: var(--ink); font-family: "Amazon Ember", Arial, "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
  body { display: flex; flex-direction: column; overflow: hidden; }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 14px; border-bottom: 1px solid var(--rule); }
  header h1 { margin: 0; font-size: 17px; font-weight: 700; }
  header .subtitle { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; }
  .legend-strip { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; padding: 6px 14px; border-bottom: 1px solid var(--rule); font-size: 12px; color: var(--ink); }
  .legend-strip span { display: inline-flex; align-items: center; gap: 6px; }
  .legend-strip i { display: inline-block; width: 22px; height: 0; border-top: 2px solid var(--line); }
  .legend-strip i.dash { border-top-style: dashed; }
  .legend-strip i.secret { border-top-color: #DD344C; }
  .legend-strip b { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
  .lgh { font-size: 14px; font-weight: 700; fill: var(--ink); }
  .lgt { font-size: 12px; font-weight: 700; fill: var(--ink); }
  .lgd { font-size: 11px; fill: var(--muted); }
  header .hint { color: var(--muted); font-size: 12px; }
  header .tools { margin-left: auto; display: flex; gap: 4px; align-items: center; }
  header .tools span { color: var(--muted); font-size: 11px; margin-right: 6px; }
  header button { min-width: 32px; height: 28px; padding: 0 8px; border: 1px solid var(--rule); border-radius: 4px; background: #fff; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
  header button:hover, header button:focus-visible { border-color: var(--pick); color: var(--pick); }
  main { position: relative; flex: 1; min-height: 0; }
  svg.map { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; user-select: none; }
  svg.map.dragging { cursor: grabbing; }
  .glbl { font-size: 13px; font-weight: 700; }
  .gnote { font-size: 11px; fill: var(--muted); }
  .lbl { font-size: 12.5px; font-weight: 700; fill: var(--ink); text-anchor: middle; }
  .sub { font-size: 11px; fill: var(--muted); text-anchor: middle; }
  .tag { font-size: 10.5px; fill: #D86613; text-anchor: middle; }
  .slbl { font-size: 12.5px; font-weight: 700; fill: var(--ink); }
  .ssub { font-size: 11px; fill: var(--muted); }
  .lanelbl { font-size: 12.5px; font-weight: 700; fill: var(--ink); }
  .dq { font-size: 12.5px; font-weight: 700; fill: #fff; text-anchor: middle; }
  .dq.start { text-anchor: start; }
  .edge { fill: none; stroke: var(--line); stroke-width: 1.5; }
  .edge.main { stroke: #232F3E; stroke-width: 2.2; }
  .edge.secret { stroke: #DD344C; }
  .edge.dashed { stroke-dasharray: 6 4; }
  .elab, .mlab { font-size: 11px; fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }
  .mlab { font-size: 11.5px; }
  .life { stroke: #AAB7B8; stroke-width: 1.2; stroke-dasharray: 4 4; }
  .sec { fill: #F2F3F3; }
  .seclbl { font-size: 11.5px; font-weight: 700; fill: var(--muted); }
  .badge { fill: #232F3E; }
  .badgen { font-size: 9.5px; font-weight: 700; fill: #fff; text-anchor: middle; }
  .hit { fill: transparent; }
  .node { cursor: pointer; outline: none; }
  .node .ring { fill: transparent; stroke: transparent; stroke-width: 2.5; }
  .node.group { pointer-events: none; } .node.group .hit { pointer-events: all; }
  .node:hover .ring, .node:focus-visible .ring { stroke: #9BA7B6; }
  .msg:hover .hit, .msg:focus-visible .hit { fill: rgba(9, 114, 211, 0.06); }
  .node.picked .ring { stroke: var(--pick); }
  .msg.picked .hit { fill: rgba(9, 114, 211, 0.10); }
  svg.focus .node:not(.near) { opacity: 0.35; }
  svg.focus .edge:not(.near), svg.focus .elab { opacity: 0.25; }
  svg.focus .edge.near { stroke: var(--pick); stroke-width: 2.2; }
  svg.focus .edge.near.arrowed { marker-end: url(#arrow-pick); }
  aside { position: fixed; top: 64px; right: 12px; z-index: 5; width: min(380px, calc(100% - 24px)); max-height: calc(100vh - 80px); overflow-y: auto; padding: 16px 18px; background: #fff; border: 1px solid var(--rule); border-radius: 8px; box-shadow: 0 8px 28px rgba(35, 47, 62, 0.18); font-size: 13px; line-height: 1.55; }
  aside[hidden] { display: none; }
  aside h2 { margin: 0 28px 2px 0; font-size: 16px; }
  aside .meta { margin: 0 0 12px; color: var(--muted); font-size: 12px; }
  aside h3 { margin: 14px 0 4px; color: var(--muted); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
  aside p { margin: 0; }
  aside ul { margin: 0; padding: 0; list-style: none; }
  aside li { padding: 8px 0; border-top: 1px solid #EAEDED; }
  aside li:first-child { border-top: 0; }
  aside a { color: var(--pick); font-size: 12px; font-family: Consolas, "Source Code Pro", monospace; text-decoration: none; word-break: break-all; }
  aside a:hover { text-decoration: underline; }
  aside .close { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border: 0; border-radius: 4px; background: transparent; color: var(--muted); font-size: 18px; cursor: pointer; }
  aside .close:hover { background: #F2F3F3; }
  @media (max-width: 640px) { header .tools span { display: none; } }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const SCRIPT = `
  var svg = document.querySelector('svg.map.body');
  var head = document.querySelector('svg.map.head');
  var side = document.querySelector('svg.map.side');
  var maps = Array.prototype.slice.call(document.querySelectorAll('svg.map'));
  var panel = document.getElementById('panel');
  var full = svg.getAttribute('viewBox').split(' ').map(Number);
  var headH = head ? Number(head.getAttribute('viewBox').split(' ')[3]) : 0;
  var sideW = side ? Number(side.getAttribute('viewBox').split(' ')[2]) : 0;
  function qa(sel) { return document.querySelectorAll('svg.map ' + sel); }
  var view = full.slice();
  var picked = null;

  function setView(v) {
    view = v;
    svg.setAttribute('viewBox', v.join(' '));
    if (head) head.setAttribute('viewBox', [v[0], 0, v[2], headH].join(' '));
    if (side) side.setAttribute('viewBox', [0, v[1], sideW, v[3]].join(' '));
  }

  function zoom(factor, cx, cy) {
    var w = Math.min(full[2] * 1.2, Math.max(full[2] / 6, view[2] / factor));
    var h = w * view[3] / view[2];
    if (cx == null) { cx = view[0] + view[2] / 2; cy = view[1] + view[3] / 2; }
    var rx = (cx - view[0]) / view[2], ry = (cy - view[1]) / view[3];
    setView([cx - rx * w, cy - ry * h, w, h]);
  }

  function toSvg(evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  document.querySelectorAll('[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-zoom');
      if (k === 'fit') setView(full.slice()); else zoom(k === 'in' ? 1.25 : 0.8);
    });
  });

  svg.addEventListener('wheel', function (evt) {
    if (!evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    var p = toSvg(evt);
    zoom(evt.deltaY < 0 ? 1.15 : 0.87, p.x, p.y);
  }, { passive: false });

  var drag = null;
  svg.addEventListener('pointerdown', function (evt) {
    if (evt.target.closest('.node')) return;
    if (evt.pointerType === 'touch' && view.join() === full.join()) return;
    drag = { x: evt.clientX, y: evt.clientY, v: view.slice(), moved: false };
    svg.setPointerCapture(evt.pointerId);
  });
  svg.addEventListener('pointermove', function (evt) {
    if (!drag) return;
    var scale = view[2] / svg.getBoundingClientRect().width;
    var dx = (evt.clientX - drag.x) * scale, dy = (evt.clientY - drag.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) { drag.moved = true; svg.classList.add('dragging'); }
    setView([drag.v[0] - dx, drag.v[1] - dy, drag.v[2], drag.v[3]]);
  });
  svg.addEventListener('pointerup', function () {
    if (drag && !drag.moved && picked) close();
    drag = null; svg.classList.remove('dragging');
  });

  function related(id) {
    var near = {};
    near[id] = true;
    var self = document.querySelector('svg.map .node[data-id="' + id + '"]');
    if (self && self.classList.contains('msg')) {
      near[self.getAttribute('data-from')] = true;
      near[self.getAttribute('data-to')] = true;
      self.querySelectorAll('.edge').forEach(function (e) { e.classList.add('near'); });
    } else {
      qa('.edge').forEach(function (e) {
        var from = e.getAttribute('data-from'), to = e.getAttribute('data-to');
        var hit = from === id || to === id;
        e.classList.toggle('near', hit);
        if (hit) { near[from] = true; near[to] = true; var m = e.closest('.msg'); if (m) near[m.getAttribute('data-id')] = true; }
      });
    }
    qa('.node').forEach(function (n) { n.classList.toggle('near', !!near[n.getAttribute('data-id')]); });
  }

  function open(id) {
    var info = D.nodes[id];
    if (!info) return;
    picked = id;
    qa('.edge.near').forEach(function (e) { e.classList.remove('near'); });
    qa('.node').forEach(function (n) { n.classList.toggle('picked', n.getAttribute('data-id') === id); });
    maps.forEach(function (m) { m.classList.add('focus'); });
    var top = document.querySelector('main').getBoundingClientRect().top;
    panel.style.top = Math.max(8, top + 12) + 'px';
    related(id);
    document.getElementById('p-title').textContent = info.label;
    var meta = document.getElementById('p-meta');
    meta.textContent = info.sub; meta.hidden = !info.sub;
    document.getElementById('p-about').textContent = info.about;
    document.getElementById('p-about-wrap').hidden = !info.about;
    var list = document.getElementById('p-code');
    list.textContent = '';
    info.src.forEach(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = s.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = s.name; a.title = s.path;
      li.appendChild(a);
      if (s.text) { var p = document.createElement('p'); p.textContent = s.text; li.appendChild(p); }
      list.appendChild(li);
    });
    document.getElementById('p-code-wrap').hidden = !info.src.length;
    panel.hidden = false;
  }

  function close() {
    picked = null;
    panel.hidden = true;
    maps.forEach(function (m) { m.classList.remove('focus'); });
    qa('.picked, .near').forEach(function (n) { n.classList.remove('picked', 'near'); });
  }

  qa('.node').forEach(function (n) {
    n.addEventListener('click', function () { open(n.getAttribute('data-id')); });
    n.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); open(n.getAttribute('data-id')); }
    });
  });
  panel.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', function (evt) { if (evt.key === 'Escape') close(); });
`;

function page({ lang, map, svgs, D, extraCss = '', strip = '' }) {
  const u = UI[lang];
  const title = pick(map.title, lang);
  const sub = pick(map.subtitle, lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}
  ${extraCss}
</style>
</head>
<body>
<header>
  <div class="titles"><h1>${esc(title)}</h1>${sub ? `<p class="subtitle">${esc(sub)}</p>` : ''}</div>
  <span class="hint">${u.hint}</span>
  <div class="tools">
    <span>${u.tools}</span>
    <button type="button" data-zoom="out" aria-label="${u.zout}" title="${u.zout}">&minus;</button>
    <button type="button" data-zoom="fit">${u.fit}</button>
    <button type="button" data-zoom="in" aria-label="${u.zin}" title="${u.zin}">+</button>
  </div>
</header>
${strip}
<main>
${svgs}
<aside id="panel" hidden aria-live="polite">
  <button class="close" type="button" aria-label="${u.close}">&times;</button>
  <h2 id="p-title"></h2>
  <p class="meta" id="p-meta"></p>
  <div id="p-about-wrap"><h3>${u.what}</h3><p id="p-about"></p></div>
  <div id="p-code-wrap"><h3>${u.code}</h3><ul id="p-code"></ul></div>
</aside>
</main>
<script>
(function () {
  var D = ${scriptJson(D)};
${SCRIPT}
})();
</script>
</body>
</html>
`;
}

function panelData(map, name, lang, numberSteps) {
  const nodes = {};
  let n = 0;
  for (const item of clickables(map)) {
    const { info, src } = resolveInfo(item, name, details, explain);
    let label = pick(item.label, lang);
    if (numberSteps && map.kind === 'sequence' && (map.steps || []).includes(item)) { n++; label = `${n}. ${label}`; }
    nodes[item.id] = { label, sub: pick(item.sub, lang), about: pick(info, lang), src: srcList(config, src, lang) };
  }
  return { nodes };
}

function lineStrip(map, lang, edges) {
  const u = UI[lang];
  const has = (f) => edges.some(f);
  const parts = [];
  if (has((e) => e.style === 'ref')) parts.push(`<span><i></i>${u.ref}</span>`);
  if (has((e) => e.style !== 'dashed' && e.style !== 'secret' && e.style !== 'ref' && !e.dashed)) parts.push(`<span><i></i>${u.call}</span>`);
  if (has((e) => e.style === 'secret')) parts.push(`<span><i class="secret"></i>${u.secret}</span>`);
  if (has((e) => e.style === 'dashed' || e.dashed)) parts.push(`<span><i class="dash"></i>${u.dashed}</span>`);
  (map.legend || []).forEach((l) => {
    const color = l.color || (l.icon && icon(l.icon) ? icon(l.icon).color : '#7D8998');
    parts.push(`<span><b style="background:${color}"></b>${esc(pick(l.title, lang))}${l.line ? ' · ' + esc(pick(l.line, lang)) : ''}</span>`);
  });
  return parts.length ? `<div class="legend-strip">${parts.join('')}</div>` : '';
}

// ---------- free: authored coordinates ----------
const GROUPS = {
  cloud: { fill: '#FBFCFD', stroke: '#8D99A8', text: '#232F3E', icon: 'architecture-group/AWSCloudlogo' },
  account: { fill: '#FFF7FB', stroke: '#E7157B', text: '#B0084D', icon: 'architecture-group/AWSAccount' },
  region: { fill: '#FFFFFF', stroke: '#00A4A6', text: '#0B6E8A', icon: 'architecture-group/Region', dash: true },
  az: { fill: '#FFFFFF', stroke: '#00A4A6', text: '#0B6E8A', dash: true },
  vpc: { fill: '#FBF9FF', stroke: '#8C4FFF', text: '#6B34D6', icon: 'architecture-group/VirtualprivatecloudVPC' },
  public: { fill: '#F3F8EA', stroke: '#7AA116', text: '#3D6A0D', icon: 'architecture-group/Publicsubnet' },
  private: { fill: '#EAF7F7', stroke: '#00A4A6', text: '#0B6E8A', icon: 'architecture-group/Privatesubnet' },
  ec2: { fill: '#FFFAF5', stroke: '#ED7100', text: '#B85A00', icon: 'architecture-group/EC2instancecontents' },
  autoscaling: { fill: '#FFFAF5', stroke: '#ED7100', text: '#B85A00', icon: 'architecture-group/AutoScalinggroup', dash: true },
  server: { fill: '#F7F8F8', stroke: '#7D8998', text: '#414D5C', icon: 'architecture-group/Servercontents' },
  datacenter: { fill: '#F7F8F8', stroke: '#7D8998', text: '#414D5C', icon: 'architecture-group/Corporatedatacenter' },
  generic: { fill: '#FAFAFB', stroke: '#7D8998', text: '#414D5C', dash: true },
  plain: { fill: '#FAFAFB', stroke: '#AAB7B8', text: '#414D5C' },
};

function renderFree(map, name, lang) {
  const used = new Set();
  const boxes = new Map();
  const out = [];
  for (const g of map.groups || []) {
    const st = { ...GROUPS[g.style || 'generic'], ...(g.color ? { stroke: g.color, text: g.color } : {}) };
    const iconName = g.icon === false ? null : (g.icon || st.icon);
    boxes.set(g.id, { cx: g.x + g.w / 2, cy: g.y + g.h / 2, w: g.w, h: g.h });
    const tx = iconName ? g.x + 34 : g.x + 14;
    const clickable = g.id && g.info !== undefined;
    const body = (clickable ? `<rect class="ring" x="${g.x - 3}" y="${g.y - 3}" width="${g.w + 6}" height="${g.h + 6}" rx="12"/>` : '')
      + `<rect${clickable ? ' class="gbody"' : ''} x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5"${st.dash ? ' stroke-dasharray="6 4"' : ''}/>`
      + (iconName ? useIcon(iconName, g.x, g.y, 26, used) : '')
      + `<text class="glbl" x="${tx}" y="${g.y + 18}" fill="${st.text}">${esc(pick(g.label, lang))}</text>`
      + (g.note ? `<text class="gnote" x="${tx}" y="${g.y + 34}">${esc(pick(g.note, lang))}</text>` : '')
      + (clickable ? `<rect class="hit" x="${g.x}" y="${g.y}" width="${r1(Math.max(textWidth(pick(g.label, lang), 13, true), textWidth(pick(g.note, lang), 11, false)) + (tx - g.x) + 12)}" height="${g.note ? 42 : 28}"/>` : '');
    out.push(clickable
      ? `<g class="node group" data-id="${g.id}" tabindex="0" role="button" aria-label="${esc(pick(g.label, lang))}">${body}</g>`
      : `<g class="group">${body}</g>`);
  }
  for (const n of map.nodes || []) {
    const s = n.size || 48;
    boxes.set(n.id, { cx: n.x, cy: n.y, w: s, h: s });
  }
  const edgeOut = [];
  for (const e of map.edges || []) {
    const a = boxes.get(e.from), b = boxes.get(e.to);
    if (!a || !b) { console.error(`  ${name}: edge ${e.from} -> ${e.to} names a missing box`); continue; }
    const mid = (e.via || []).map((p) => [p[0], p[1]]);
    const first = mid[0] || [b.cx, b.cy];
    const last = mid[mid.length - 1] || [a.cx, a.cy];
    const start = e.fromPoint || clip(a, first, e.fromGap ?? 6);
    const end = e.toPoint || clip(b, last, e.arrow === false ? (e.toGap ?? 6) : (e.toGap ?? 6));
    const pts = [start, ...mid, end];
    edgeOut.push(`<path class="${edgeClass(e)}" data-from="${e.from}" data-to="${e.to}" d="${pathD(pts)}"${marker(e)}/>` + edgeLabel(e, pts, lang));
  }
  out.push(...edgeOut);
  for (const n of map.nodes || []) {
    const s = n.size || 48;
    const x0 = n.x - s / 2, y0 = n.y - s / 2;
    const label = wrap(pick(n.label, lang), n.labelWidth || 150, 12.5, true, 3);
    const sub = wrap(pick(n.sub, lang), n.labelWidth || 150, 11, false, 3);
    let y = y0 + s + 18;
    let text = lines('lbl', label, n.x, y, 15); y += label.length * 15;
    if (sub.length) { text += lines('sub', sub, n.x, y - 1, 13); y += sub.length * 13; }
    if (n.tag) text += `<text class="tag" x="${n.x}" y="${y}">${esc(pick(n.tag, lang))}</text>`;
    out.push(`<g class="node" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(pick(n.label, lang))}"><rect class="ring" x="${x0 - 6}" y="${y0 - 6}" width="${s + 12}" height="${s + 12}" rx="6"/>${useIcon(n.icon, x0, y0, s, used)}${text}</g>`);
  }
  // Legend panel on the right: icons used, then the line kinds used.
  const u = UI[lang];
  let legendW = 0;
  const W = map.width, H = map.height;
  if (map.legend !== false) {
    const items = map.legend || autoLegend(map);
    const lx = W + 20, lw = 240;
    let y = 46;
    const rows = [`<text class="lgh" x="${lx + 16}" y="${y}">${u.legend}</text>`];
    y += 19;
    for (const it of items) {
      const desc = wrap(pick(it.line, lang), 170, 11, false, 3);
      rows.push(useIcon(it.icon, lx + 16, y, 26, used)
        + `<text class="lgt" x="${lx + 54}" y="${y + 11}">${esc(pick(it.title, lang))}</text>`
        + lines('lgd', desc, lx + 54, y + 26, 13));
      y += Math.max(44, 30 + desc.length * 13);
    }
    const edges = map.edges || [];
    const kinds = [];
    if (edges.some((e) => !e.style || e.style === 'main')) kinds.push(['', u.call, u.callLine]);
    if (edges.some((e) => e.style === 'secret')) kinds.push([' secret', u.secret, u.secretLine]);
    if (edges.some((e) => e.style === 'dashed' || e.dashed)) kinds.push([' dashed', u.dashed, u.dashedLine]);
    if (kinds.length) y += 8;
    for (const [cls, t, d] of kinds) {
      const desc = wrap(d, 170, 11, false, 3);
      rows.push(`<line x1="${lx + 15}" y1="${y + 8}" x2="${lx + 43}" y2="${y + 8}" class="edge${cls}"/>`
        + `<text class="lgt" x="${lx + 54}" y="${y + 6}">${esc(t)}</text>` + lines('lgd', desc, lx + 54, y + 21, 13));
      y += Math.max(44, 26 + desc.length * 13);
    }
    out.push(`<g class="legend-panel"><rect x="${lx}" y="20" width="${lw}" height="${y - 12}" rx="10" fill="#fff" stroke="#D5DBDB"/>${rows.join('')}</g>`);
    legendW = lw + 30;
  }
  const vbW = W + legendW;
  const svg = `<svg class="map body" viewBox="0 0 ${vbW} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(pick(map.title, lang))}">
${defs(used)}
${out.join('\n')}
</svg>`;
  return { svgs: svg, extraCss: '' };
}

function autoLegend(map) {
  const seen = new Map();
  for (const g of map.groups || []) {
    const st = GROUPS[g.style || 'generic'];
    const ic = g.icon === false ? null : (g.icon || st.icon);
    if (ic && !seen.has(ic)) seen.set(ic, { icon: ic, title: g.legendTitle || g.label, line: g.legendLine || g.note || '' });
  }
  for (const n of map.nodes || []) {
    if (n.icon && !seen.has(n.icon)) seen.set(n.icon, { icon: n.icon, title: n.legendTitle || n.label, line: n.legendLine || n.sub || '' });
  }
  return [...seen.values()];
}

// ---------- sequence: actors across the top, numbered steps down ----------
function renderSequence(map, name, lang) {
  const used = new Set();
  const actors = map.actors || [];
  const GAP = map.gap || 200, X0 = 124, HEAD = 108;
  const ax = new Map(actors.map((a, i) => [a.id, X0 + i * GAP]));
  const baseW = X0 * 2 + (actors.length - 1) * GAP;
  const head = [];
  for (const a of actors) {
    const x = ax.get(a.id);
    const label = wrap(pick(a.label, lang), GAP - 20, 12.5, true, 1);
    const sub = wrap(pick(a.sub, lang), GAP - 20, 11, false, 1);
    head.push(`<g class="node" data-id="${a.id}" tabindex="0" role="button" aria-label="${esc(pick(a.label, lang))}"><rect class="ring" x="${x - 26}" y="14" width="52" height="52" rx="6"/>${useIcon(a.icon, x - 20, 20, 40, used)}${lines('lbl', label, x, 80, 15)}${lines('sub', sub, x, 96, 13)}</g>`);
  }
  const body = [];
  let y = HEAD + 20;
  let n = 0;
  let maxX = baseW;
  const edges = [];
  for (const s of map.steps || []) {
    if (s.section) {
      body.push(`<rect class="sec" x="12" y="${y}" width="${baseW - 24}" height="26" rx="4"/><text class="seclbl" x="24" y="${y + 18}">${esc(pick(s.section, lang))}</text>`);
      y += 36;
      continue;
    }
    n++;
    edges.push(s);
    const x1 = ax.get(s.from), x2 = ax.get(s.to);
    if (x1 == null || x2 == null) { console.error(`  ${name}: step ${n} names a missing actor (${s.from} -> ${s.to})`); continue; }
    const label = pick(s.label, lang);
    const tw = textWidth(label, 11.5, false);
    const cls = edgeClass(s);
    const aria = esc(`${n}. ${label}`);
    if (x1 === x2) {
      const ly = y + 16;
      const lx = x1 + 52;
      const end = lx + tw;
      maxX = Math.max(maxX, end + 12);
      body.push(`<g class="msg node" data-id="${s.id}" data-from="${s.from}" data-to="${s.to}" tabindex="0" role="button" aria-label="${aria}"><rect class="hit" x="${x1 - 14}" y="${y}" width="${r1(end - x1 + 24)}" height="44"/><path class="${cls}" data-from="${s.from}" data-to="${s.to}" d="M${x1} ${ly} L${x1 + 44} ${ly} L${x1 + 44} ${ly + 18} L${x1 + 4} ${ly + 18}"${marker(s)}/><circle class="badge" cx="${x1 - 14}" cy="${ly}" r="8"/><text class="badgen" x="${x1 - 14}" y="${ly + 3.5}">${n}</text><text class="mlab" x="${lx}" y="${ly + 13}" text-anchor="start">${esc(label)}</text></g>`);
      y += 60;
      continue;
    }
    const dir = x2 > x1 ? 1 : -1;
    const ly = y + 26;
    const span = Math.abs(x2 - x1);
    let lx, anchor;
    if (tw <= span - 40) { lx = (x1 + x2) / 2; anchor = 'middle'; }
    else { lx = Math.min(x1, x2) + 26; anchor = 'start'; maxX = Math.max(maxX, lx + tw + 12); }
    const bx = x1 + dir * 13;
    body.push(`<g class="msg node" data-id="${s.id}" data-from="${s.from}" data-to="${s.to}" tabindex="0" role="button" aria-label="${aria}"><rect class="hit" x="${Math.min(x1, x2)}" y="${y}" width="${Math.max(span, anchor === 'start' ? tw + 30 : span)}" height="34"/><path class="${cls}" data-from="${s.from}" data-to="${s.to}" d="M${x1 + dir * 24} ${ly} L${x2 - dir * 6} ${ly}"${marker(s)}/><circle class="badge" cx="${bx}" cy="${ly}" r="8"/><text class="badgen" x="${bx}" y="${ly + 3.5}">${n}</text><text class="mlab" x="${r1(lx)}" y="${ly - 8}" text-anchor="${anchor}">${esc(label)}</text></g>`);
    y += 48;
  }
  const H = y + 12;
  const W = Math.ceil(maxX);
  const life = actors.map((a) => `<line class="life" x1="${ax.get(a.id)}" y1="${HEAD}" x2="${ax.get(a.id)}" y2="${H - 12}"/>`).join('\n');
  const aria = esc(pick(map.title, lang));
  const svgs = `<svg class="map head" viewBox="0 0 ${W} ${HEAD}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}">
${defs(used)}
${head.join('\n')}</svg>
<svg class="map body" viewBox="0 ${HEAD} ${W} ${H - HEAD}" preserveAspectRatio="xMidYMid meet">${life}
${body.join('\n')}
</svg>`;
  const extraCss = `main { overflow-y: auto; } svg.map { height: auto; width: min(100%, ${Math.round(W * 1.15)}px); margin: 0 auto; } svg.map.head { position: sticky; top: 0; z-index: 3; background: #fff; box-shadow: 0 2px 6px rgba(35, 47, 62, 0.08); cursor: default; }`;
  return { svgs, extraCss, strip: lineStrip(map, lang, edges) };
}

// ---------- lanes: one row per role or system, columns by order ----------
function renderLanes(map, name, lang) {
  const used = new Set();
  const lanes = map.lanes || [];
  const nodes = map.nodes || [];
  const edges = map.edges || [];
  const LANE_H = map.laneHeight || 132, TOP = 16, SIDE = 140, COL = 292, NODE_W = 196, X0 = SIDE + 58;
  const laneIdx = new Map(lanes.map((l, i) => [l.id, i]));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Columns: longest path from the starts over forward edges; back edges found by DFS are ignored.
  const out = new Map(nodes.map((n) => [n.id, []]));
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) { if (out.has(e.from) && byId.has(e.to)) { out.get(e.from).push(e); incoming.set(e.to, incoming.get(e.to) + 1); } }
  const back = new Set();
  const state = new Map();
  const dfs = (id) => {
    state.set(id, 1);
    for (const e of out.get(id) || []) {
      const s = state.get(e.to);
      if (s === 1) back.add(e);
      else if (!s) dfs(e.to);
    }
    state.set(id, 2);
  };
  nodes.filter((n) => n.type === 'start' || !incoming.get(n.id)).forEach((n) => { if (!state.get(n.id)) dfs(n.id); });
  nodes.forEach((n) => { if (!state.get(n.id)) dfs(n.id); });
  const rank = new Map();
  const order = [];
  const seen = new Set();
  const topo = (id) => { if (seen.has(id)) return; seen.add(id); for (const e of out.get(id) || []) if (!back.has(e)) topo(e.to); order.unshift(id); };
  nodes.forEach((n) => topo(n.id));
  order.forEach((id) => { if (!rank.has(id)) rank.set(id, 0); for (const e of out.get(id) || []) if (!back.has(e)) rank.set(e.to, Math.max(rank.get(e.to) || 0, rank.get(id) + 1)); });
  const taken = new Set();
  const col = new Map();
  [...nodes].sort((a, b) => (a.col ?? rank.get(a.id)) - (b.col ?? rank.get(b.id))).forEach((n) => {
    let c = n.col ?? rank.get(n.id);
    while (taken.has(laneIdx.get(n.lane) + ':' + c)) c++;
    taken.add(laneIdx.get(n.lane) + ':' + c);
    col.set(n.id, c);
  });

  // Boxes
  const box = new Map();
  const shapes = [];
  for (const n of nodes) {
    const li = laneIdx.get(n.lane);
    if (li == null) { console.error(`  ${name}: node ${n.id} names a missing lane ${n.lane}`); continue; }
    const cx = X0 + col.get(n.id) * COL + NODE_W / 2;
    const cy = TOP + li * LANE_H + LANE_H / 2;
    const label = pick(n.label, lang), sub = pick(n.sub, lang);
    const aria = esc(label);
    if (n.type === 'decision') {
      const ll = wrap(label, 130, 12.5, true, 3);
      const h = Math.max(64, 30 + ll.length * 15);
      const w = NODE_W;
      box.set(n.id, { cx, cy, w, h });
      shapes.push(`<g class="node decision" data-id="${n.id}" tabindex="0" role="button" aria-label="${aria}"><polygon class="ring" points="${cx},${cy - h / 2 - 5} ${cx + w / 2 + 6},${cy} ${cx},${cy + h / 2 + 5} ${cx - w / 2 - 6},${cy}"/><polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" fill="#232F3E"/>${lines('dq', ll, cx, cy + 4.5 - (ll.length - 1) * 7.5, 15)}</g>`);
      continue;
    }
    if (n.type === 'start') {
      const ll = wrap(label, NODE_W - 50, 12.5, true, 2);
      const h = Math.max(46, 20 + ll.length * 15);
      box.set(n.id, { cx, cy, w: NODE_W, h });
      const x0 = cx - NODE_W / 2, y0 = cy - h / 2;
      shapes.push(`<g class="node start" data-id="${n.id}" tabindex="0" role="button" aria-label="${aria}"><rect class="ring" x="${x0 - 4}" y="${y0 - 4}" width="${NODE_W + 8}" height="${h + 8}" rx="${h / 2 + 4}"/><rect x="${x0}" y="${y0}" width="${NODE_W}" height="${h}" rx="${h / 2}" fill="#232F3E"/><circle cx="${x0 + 22}" cy="${cy}" r="7" fill="#fff"/>${lines('dq start', ll, x0 + 38, cy + 4.5 - (ll.length - 1) * 7.5, 15)}</g>`);
      continue;
    }
    const isEnd = n.type === 'end';
    const ll = wrap(label, NODE_W - 62, 12.5, true, 3);
    const sl = wrap(sub, NODE_W - 62, 11, false, 4);
    const h = Math.max(73, 26 + ll.length * 15 + sl.length * 14);
    box.set(n.id, { cx, cy, w: NODE_W, h });
    const x0 = cx - NODE_W / 2, y0 = cy - h / 2;
    const ic = n.icon ? icon(n.icon) : null;
    const accent = n.color || (ic ? ic.color : (isEnd ? '#5F6B7A' : '#232F3E'));
    const glyph = isEnd
      ? `<circle cx="${x0 + 28}" cy="${cy}" r="10" fill="none" stroke="${accent}" stroke-width="3"/>`
      : n.icon ? useIcon(n.icon, x0 + 14, cy - 14, 28, used) : `<rect x="${x0 + 14}" y="${cy - 14}" width="28" height="28" rx="4" fill="${accent}"/>`;
    const textTop = cy - (ll.length * 15 + sl.length * 14) / 2 + 11;
    shapes.push(`<g class="node step" data-id="${n.id}" tabindex="0" role="button" aria-label="${aria}"><rect class="ring" x="${x0 - 4}" y="${y0 - 4}" width="${NODE_W + 8}" height="${h + 8}" rx="9"/><rect x="${x0}" y="${y0}" width="${NODE_W}" height="${h}" rx="6" fill="#fff" stroke="${isEnd ? '#AAB7B8' : '#232F3E'}" stroke-width="${isEnd ? 1.2 : 1.6}"/><rect x="${x0}" y="${y0}" width="5" height="${h}" rx="2" fill="${accent}"/>${glyph}${lines('slbl', ll, x0 + 52, textTop, 15)}${lines('ssub', sl, x0 + 52, textTop + ll.length * 15 + 1, 14)}</g>`);
  }

  // Edges
  const paths = [];
  for (const e of edges) {
    const a = box.get(e.from), b = box.get(e.to);
    if (!a || !b) { console.error(`  ${name}: edge ${e.from} -> ${e.to} names a missing node`); continue; }
    const ca = col.get(e.from), cb = col.get(e.to);
    const la = laneIdx.get(byId.get(e.from).lane), lb = laneIdx.get(byId.get(e.to).lane);
    let pts;
    if (cb > ca && la === lb) pts = [[a.cx + a.w / 2, a.cy], [b.cx - b.w / 2 - 6, b.cy]];
    else if (cb > ca) { const mx = a.cx + a.w / 2 + 48; pts = [[a.cx + a.w / 2, a.cy], [mx, a.cy], [mx, b.cy], [b.cx - b.w / 2 - 6, b.cy]]; }
    else if (cb === ca) pts = lb > la ? [[a.cx, a.cy + a.h / 2], [b.cx, b.cy - b.h / 2 - 6]] : [[a.cx, a.cy - a.h / 2], [b.cx, b.cy + b.h / 2 + 6]];
    else {
      // back edge: drop below the lower box, run left, come up into the target from below
      const yl = Math.max(a.cy + a.h / 2, b.cy + b.h / 2) + 14;
      pts = [[a.cx, a.cy + a.h / 2], [a.cx, yl], [b.cx, yl], [b.cx, b.cy + b.h / 2 + 6]];
    }
    const at = e.at ?? (pts.length === 4 ? 0.5 : 0.5);
    paths.push(`<path class="${edgeClass(e, e.style === 'dashed' || e.style === 'secret' || e.style === 'ref' ? '' : 'main')}" data-from="${e.from}" data-to="${e.to}" d="${pathD(pts)}"${marker(e)}/>` + edgeLabel({ ...e, at }, pts, lang));
  }

  const maxCol = Math.max(0, ...col.values());
  const W = X0 + (maxCol + 1) * COL;
  const H = TOP * 2 + lanes.length * LANE_H;
  const sideRows = lanes.map((l, i) => {
    const ll = wrap(pick(l.label, lang), SIDE - 24, 12.5, true, 3);
    const y = TOP + i * LANE_H + LANE_H / 2 + 4.5 - (ll.length - 1) * 7.5;
    return `<rect x="0" y="${TOP + i * LANE_H}" width="${SIDE}" height="${LANE_H}" fill="#EEF1F2" stroke="#D5DBDB"/>${lines('lanelbl', ll, 14, y, 15)}`;
  }).join('\n');
  const bands = lanes.map((l, i) => `<rect x="0" y="${TOP + i * LANE_H}" width="${W}" height="${LANE_H}" fill="${i % 2 ? '#F7F8F8' : '#FFFFFF'}" stroke="#D5DBDB"/>`).join('\n');
  const aria = esc(pick(map.title, lang));
  const svgs = `<div class="lanes-wrap"><svg class="map side" viewBox="0 0 ${SIDE} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}">
${defs(used)}
${sideRows}</svg>
<svg class="map body" viewBox="${SIDE} 0 ${W - SIDE} ${H}" preserveAspectRatio="xMidYMid meet">${bands}
${paths.join('\n')}
${shapes.join('\n')}
</svg></div>`;
  const extraCss = `main { overflow: auto; } .lanes-wrap { display: flex; height: 100%; width: max-content; } svg.map.side { position: sticky; left: 0; z-index: 3; height: 100%; width: auto; aspect-ratio: ${SIDE} / ${H}; background: #fff; box-shadow: 2px 0 6px rgba(35, 47, 62, 0.08); cursor: default; } svg.map.body { height: 100%; width: auto; aspect-ratio: ${W - SIDE} / ${H}; max-width: none; }`;
  return { svgs, extraCss, strip: lineStrip(map, lang, edges.map((e) => ({ ...e, style: e.style || 'main' }))) };
}

// ---------- main ----------
const dir = path.join(OUT, 'diagrams');
ensureDir(dir);
let count = 0;
for (const [name, map] of Object.entries(maps)) {
  if (only.length && !only.includes(name)) continue;
  const render = { free: renderFree, sequence: renderSequence, lanes: renderLanes }[map.kind];
  if (!render) { console.error(`${name}: unknown kind "${map.kind}" (free, sequence or lanes)`); process.exitCode = 1; continue; }
  clickables(map); // gives unnamed sequence steps their ids (m1, m2, ...) before rendering
  for (const lang of LANGS) {
    const { svgs, extraCss, strip } = render(map, name, lang);
    const D = panelData(map, name, lang, true);
    fs.writeFileSync(path.join(dir, `${name}-map-${lang}.html`), page({ lang, map, svgs, D, extraCss, strip }));
    count++;
  }
}
if (missingIcons.size) {
  console.error('icons not found (looked in ' + ICON_DIR + '):');
  for (const m of missingIcons) console.error(`  ${m}  close matches: ${suggest(m).join(', ') || 'none'}`);
  process.exitCode = 1;
}
console.log(`wrote ${count} diagram pages to out/diagrams`);
