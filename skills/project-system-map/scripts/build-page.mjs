// Assembles out/index.html: header (title, dates, counts), the sidebar of tabs from
// map-config.mjs groups, one panel per pages/<tab id>.html, the diagram iframes, code links,
// the Save as Markdown buttons and the tab script. The output is a claude.ai artifact page
// (a fragment without <html>/<head>); build-single.mjs wraps it into one offline file.
//   node build-page.mjs
import fs from 'node:fs';
import path from 'node:path';
import { WORK, OUT, loadAll, pick, esc, both, parseCite, citeHref, citeName, elementEnd, tabList, ensureDir } from './lib.mjs';

const { config, maps } = await loadAll();
const tabs = tabList(config);
const pagesDir = path.join(WORK, 'pages');
const read = (p) => fs.readFileSync(p, 'utf8');
let problems = 0;
const fail = (msg) => { console.error(msg); problems++; };

function expandIncludes(html, depth = 0) {
  return html.replace(/<!--\s*include:\s*([^\s]+)\s*-->/g, (all, file) => {
    const p = path.join(pagesDir, file);
    if (!fs.existsSync(p)) { fail(`include ${file} not found in pages/`); return ''; }
    return depth > 4 ? '' : expandIncludes(read(p), depth + 1);
  });
}

function expandFigures(html) {
  const re = /<div class="figure" data-map="([^"]+)"[^>]*>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1];
    const end = elementEnd(html, m.index);
    if (end < 0) { fail(`figure ${name} is not closed`); continue; }
    const map = maps[name];
    if (!map) fail(`figure names unknown diagram "${name}"`);
    let inner = html.slice(m.index + m[0].length, end - '</div>'.length);
    const title = esc(pick(map && map.title, 'en') || name);
    if (!/<iframe\b/.test(inner)) inner = `\n    <iframe data-diagram="${name}" title="${title}" loading="lazy"></iframe>` + inner;
    const full = `<a data-full="${name}" target="_blank" rel="noopener">${both({ ko: '전체 화면으로 열기', en: 'Open full screen' })}</a>`;
    if (!/data-full=/.test(inner)) {
      const ci = inner.search(/<div class="cap">/);
      if (ci >= 0) {
        const ce = elementEnd(inner, ci);
        inner = inner.slice(0, ce - '</div>'.length) + `  ${full}\n    </div>` + inner.slice(ce);
      } else inner += `  <div class="cap"><span></span>${full}</div>\n  `;
    }
    out += html.slice(last, m.index) + m[0] + inner + '</div>';
    last = end;
    re.lastIndex = end;
  }
  return out + html.slice(last);
}

function expandCites(html) {
  return html.replace(/<a([^>]*?)\sdata-cite="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, pre, cite, post, text) => {
    const ci = parseCite(cite);
    if (ci.bad) { fail(`bad data-cite "${cite}"`); return all; }
    const attrs = (pre + post).replace(/\s(href|target|rel)="[^"]*"/g, '');
    const label = text.trim() ? text : `<code>${esc(citeName(ci))}</code>`;
    return `<a${attrs} data-cite="${cite}" href="${esc(citeHref(config, ci))}" target="_blank" rel="noopener">${label}</a>`;
  });
}

// ---------- panels ----------
const panels = [];
let diagramsUsed = new Set();
for (const t of tabs) {
  const p = path.join(pagesDir, `${t.id}.html`);
  if (!fs.existsSync(p)) { fail(`pages/${t.id}.html is missing (tab "${pick(t, 'en')}")`); continue; }
  let body = expandCites(expandFigures(expandIncludes(read(p))));
  for (const m of body.matchAll(/data-diagram="([^"]+)"/g)) diagramsUsed.add(m[1]);
  panels.push(`<section class="panel" role="tabpanel" id="${t.id}" aria-labelledby="tab-${t.id}" hidden>
  <h2 class="tab-title">${both(t)}</h2>
${body.trim()}
</section>`);
}
for (const name of Object.keys(maps)) if (!diagramsUsed.has(name)) console.warn(`note: diagram "${name}" is not placed on any tab`);

// ---------- header ----------
let citeCount = null;
try { citeCount = JSON.parse(read(path.join(OUT, 'cite-count.json'))).unique; } catch { /* check-cites not run yet */ }
const stats = [
  [tabs.length, { ko: '탭', en: 'tabs' }],
  [diagramsUsed.size, { ko: '그림', en: 'diagrams' }],
  ...(config.stats || []).map((s) => [s.n, s]),
  ...(citeCount != null ? [[citeCount, { ko: '확인한 코드 링크', en: 'code links checked' }]] : []),
];
const nav = (config.groups || []).map((g) =>
  `      <div class="grp">${both(g)}</div>\n` + (g.tabs || []).map((t) =>
    `      <button type="button" role="tab" id="tab-${t.id}" aria-controls="${t.id}" aria-selected="false">${both(t)}</button>`).join('\n')).join('\n');

const css = read(fs.existsSync(path.join(pagesDir, 'page.css')) ? path.join(pagesDir, 'page.css') : path.join(WORK, 'page.css'));
const mdExport = read(path.join(WORK, 'md-export.js'));
const slug = config.slug || String(pick(config.name, 'en')).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const name = pick(config.name, 'en');

const TAB_SCRIPT = `
(function () {
  var root = document.documentElement;
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var ids = tabs.map(function (t) { return t.getAttribute('aria-controls'); });
  var first = ids[0];
  var lang = 'ko';
  var current = first;
  var KEY = ${JSON.stringify(slug + '-map-' + (config.defaultLang === 'en' ? 'en' : 'ko') + '-')}; // a new default language resets remembered choices

  function store(key, value) { try { localStorage.setItem(KEY + key, value); } catch (e) {} }
  function read(key) { try { return localStorage.getItem(KEY + key); } catch (e) { return null; } }

  function diagramSrc(name) { return 'diagrams/' + name + '-map-' + lang + '.html'; }

  var embedded = window.MAP_DIAGRAMS || null;
  var blobs = {};
  function embeddedKey(name) { return name + '-map-' + lang; }
  function embeddedUrl(name) {
    var key = embeddedKey(name);
    if (!blobs[key]) blobs[key] = URL.createObjectURL(new Blob([embedded[key]], { type: 'text/html' }));
    return blobs[key];
  }

  function loadDiagrams(panel) {
    panel.querySelectorAll('iframe[data-diagram]').forEach(function (frame) {
      var name = frame.getAttribute('data-diagram');
      if (embedded) {
        var key = embeddedKey(name);
        if (frame.getAttribute('data-loaded') !== key) { frame.srcdoc = embedded[key]; frame.setAttribute('data-loaded', key); }
        return;
      }
      var src = diagramSrc(name);
      if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    });
  }

  function updateLinks() {
    document.querySelectorAll('a[data-full]').forEach(function (a) {
      var name = a.getAttribute('data-full');
      a.setAttribute('href', embedded ? embeddedUrl(name) : diagramSrc(name));
    });
  }

  function show(id, focus) {
    if (ids.indexOf(id) === -1) id = first;
    var changed = id !== current;
    current = id;
    tabs.forEach(function (t) {
      var on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      if (on && t.scrollIntoView && window.matchMedia('(max-width: 960px)').matches) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    ids.forEach(function (pid) {
      var p = document.getElementById(pid);
      p.hidden = pid !== id;
      if (pid === id) loadDiagrams(p);
    });
    store('tab', id);
    if (location.hash !== '#' + id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
    if (changed) { try { window.scrollTo(0, 0); } catch (e) {} }
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ko';
    root.setAttribute('data-ui', lang);
    root.setAttribute('lang', lang);
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang-btn') === lang ? 'true' : 'false');
    });
    updateLinks();
    loadDiagrams(document.getElementById(current));
    store('lang', lang);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.getAttribute('aria-controls'), false); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length;
      if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (k === 'Home') n = 0;
      if (k === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); show(tabs[n].getAttribute('aria-controls'), true); }
    });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && ids.indexOf(a.getAttribute('href').slice(1)) !== -1) { e.preventDefault(); show(a.getAttribute('href').slice(1), false); }
  });
  document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang-btn')); });
  });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });

  var startTab = location.hash.slice(1) || read('tab') || first;
  current = ids.indexOf(startTab) === -1 ? first : startTab;
  setLang(read('lang') || ${JSON.stringify(config.defaultLang === 'en' ? 'en' : 'ko')});
  show(current, false);
})();
`;

// Themes: five palettes (page.css), each with a light and a dark set, plus a mode switch.
const PALETTES = [
  { id: 'harbor', ko: '하버', en: 'Harbor', sw: 'oklch(0.55 0.13 245)' },
  { id: 'moss', ko: '모스', en: 'Moss', sw: 'oklch(0.55 0.11 155)' },
  { id: 'ember', ko: '엠버', en: 'Ember', sw: 'oklch(0.58 0.16 32)' },
  { id: 'iris', ko: '아이리스', en: 'Iris', sw: 'oklch(0.55 0.14 290)' },
  { id: 'graphite', ko: '그래파이트', en: 'Graphite', sw: 'linear-gradient(135deg, oklch(0.36 0.01 250) 50%, oklch(0.62 0.10 200) 50%)' },
];
const defaultPalette = PALETTES.some((x) => x.id === config.defaultPalette) ? config.defaultPalette : 'harbor';
const themeControls = `<div class="theme-pick" role="group" aria-label="Theme">
        <span class="tp-label">${both({ ko: '테마', en: 'Theme' })}</span>
        <span class="swatches">${PALETTES.map((x) => `<button type="button" data-palette-btn="${x.id}" style="--sw: ${x.sw}" aria-pressed="false" aria-label="${esc(x.en)}" title="${esc(x.en)}"></button>`).join('')}</span>
        <span class="mode-switch">${[['auto', { ko: '자동', en: 'Auto' }], ['light', { ko: '밝게', en: 'Light' }], ['dark', { ko: '어둡게', en: 'Dark' }]].map(([m, l]) => `<button type="button" data-mode-btn="${m}" aria-pressed="false">${both(l)}</button>`).join('')}</span>
      </div>`;
// Runs before the page paints, so a remembered theme never flashes the default first.
const EARLY_THEME = `(function () {
  var r = document.documentElement, K = ${JSON.stringify(slug + '-map-')};
  function read(k) { try { return localStorage.getItem(K + k); } catch (e) { return null; } }
  r.setAttribute('data-palette', read('palette') || ${JSON.stringify(defaultPalette)});
  var m = read('mode'); if (m === 'light' || m === 'dark') r.setAttribute('data-mode', m);
})();`;
const THEME_SCRIPT = `(function () {
  var r = document.documentElement, K = ${JSON.stringify(slug + '-map-')};
  function store(k, v) { try { if (v == null) localStorage.removeItem(K + k); else localStorage.setItem(K + k, v); } catch (e) {} }
  function sync() {
    var p = r.getAttribute('data-palette'), m = r.getAttribute('data-mode') || 'auto';
    document.querySelectorAll('[data-palette-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-palette-btn') === p ? 'true' : 'false'); });
    document.querySelectorAll('[data-mode-btn]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode-btn') === m ? 'true' : 'false'); });
  }
  document.querySelectorAll('[data-palette-btn]').forEach(function (b) {
    b.addEventListener('click', function () { var v = b.getAttribute('data-palette-btn'); r.setAttribute('data-palette', v); store('palette', v); sync(); });
  });
  document.querySelectorAll('[data-mode-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-mode-btn');
      if (v === 'auto') { r.removeAttribute('data-mode'); store('mode', null); } else { r.setAttribute('data-mode', v); store('mode', v); }
      sync();
    });
  });
  sync();
})();`;

const html = `<title>${esc(config.pageTitle ? pick(config.pageTitle, 'en') : `${name} System Map`)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
<script>${EARLY_THEME}</script>

<div class="wrap">
  <header class="top">
    <div class="top-main">
      <p class="eyebrow">${both(config.eyebrow || { ko: `${name} · 아키텍처와 프로젝트 문서`, en: `${name} · Architecture and project guide` })}</p>
      <h1>${both(config.title)}</h1>
      <p class="summary ko" lang="ko">${esc(pick(config.summary, 'ko'))}</p>
      <p class="summary en" lang="en">${esc(pick(config.summary, 'en'))}</p>
      <p class="dates"><span class="ko">만든 날 ${esc(config.created)} · 마지막 수정 ${esc(config.updated)}</span><span class="en">Created ${esc(config.created)} · Last updated ${esc(config.updated)}</span></p>
      <ul class="stats">
${stats.map(([n, l]) => `        <li><strong>${esc(n)}</strong>${both(l)}</li>`).join('\n')}
      </ul>
    </div>
    <div class="top-tools">
      ${themeControls}
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" id="lang-ko" data-lang-btn="ko" aria-pressed="true">한국어</button>
        <button type="button" id="lang-en" data-lang-btn="en" aria-pressed="false">English</button>
      </div>
      <div class="md-export" role="group" aria-label="Markdown">
        <span class="md-label">${both({ ko: 'Markdown 저장', en: 'Save as Markdown' })}</span>
        <button type="button" data-md="tab">${both({ ko: '이 탭', en: 'This tab' })}</button>
        <button type="button" data-md="all">${both({ ko: '전체 문서', en: 'Whole document' })}</button>
        <p class="md-status" id="md-status" role="status" aria-live="polite"></p>
      </div>
    </div>
  </header>

  <div class="shell">
    <nav class="side" role="tablist" aria-orientation="vertical" aria-label="Contents">
${nav}
    </nav>
    <main class="content">
${panels.join('\n\n')}
    </main>
  </div>
</div>
<script>document.documentElement.setAttribute('data-map-slug', ${JSON.stringify(slug)}); document.documentElement.setAttribute('data-map-name', ${JSON.stringify(name)});</script>
<!--MAP_DIAGRAMS-->
<script>${TAB_SCRIPT}</script>
<script>${THEME_SCRIPT}</script>
<script>
${mdExport}
</script>
`;

ensureDir(OUT);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`wrote out/index.html: ${panels.length} tabs, ${diagramsUsed.size} diagrams${problems ? `, ${problems} problems` : ''}`);
if (problems) process.exitCode = 1;
