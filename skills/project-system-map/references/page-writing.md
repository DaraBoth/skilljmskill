# Writing the tab pages

## The menu of tabs
Start here, drop what the system lacks, add one tab per major subsystem. Group names become the
sidebar headings (`map-config.mjs` `groups`). Order the sidebar the way a new developer should
read it.

| group | tabs |
|---|---|
| Overview | system in context (who uses it, what it talks to), words used in this document |
| Building blocks | containers or processes, code modules and screens |
| Deployment | cloud and network, release and deploy |
| Runtime flows | one tab per key flow: sign-in, the main write path, background jobs, publishing |
| Data | collections or tables and their statuses, Database schema (required, generated) |
| Interfaces | HTTP API (generated), MCP or other tool surface (generated), file formats |
| Roles | one tab per role or user journey, each with an "Every branch" table |
| Project | working on the code: run it, test it, where to change what, conventions |

No "open decisions", "risks" or "TODO" tab. The document states how things are; problems go to
the owner in `findings-<date>.md` (path:line each).

## `map-config.mjs`
```js
export default {
  name: 'Bookshop', slug: 'bookshop', pageTitle?: 'Bookshop System Map',
  repoPath: '../bookshop', repoUrl: 'https://github.com/your-org/bookshop',
  rev: '<full pushed sha>', linkBase?: '...',
  created: 'YYYY-MM-DD', updated: 'YYYY-MM-DD',
  singleFileName: 'bookshop-system-map.html',
  iconDir: 'dl-aws-icons/package/icons', icons?: { name: 'file.svg' },
  eyebrow?: { ko, en }, title: { ko, en }, summary: { ko, en },
  stats: [{ n: 146, ko: 'API 경로', en: 'API routes' }], // tabs, diagrams and checked code links are added for you
  groups: [{ ko, en, tabs: [{ id, ko, en }] }],
  defaultLang?: 'ko',
};
```
The header shows only the title, summary, created and last-updated dates and the counts row.
No repo, branch or commit chips.

## One page per tab: `pages/<tab id>.html`
A fragment. `build-page.mjs` adds the `<section>` and the tab title. Shape:
```html
  <p class="lead ko" lang="ko">한두 문장: 이 탭이 무엇을 설명하는지.</p>
  <p class="lead en" lang="en">One or two sentences: what this tab explains.</p>

  <div class="figure" data-map="signin">
    <div class="cap">
      <span class="ko">그림 읽는 법 한 줄.</span>
      <span class="en">One line on how to read the diagram.</span>
    </div>
  </div>

  <div class="notes">
    <h2><span class="ko">…</span><span class="en">…</span></h2>
    …
  </div>
```
- The figure gets its iframe and the "Open full screen" link from `build-page.mjs`, and its
  What / How / Why row from `add-www.mjs` (`www-data.mjs`: `{ <diagram>: { what, how, why } }`,
  one short sentence each, both languages). Do not write either by hand.
- Bilingual everywhere: `<span class="ko">…</span><span class="en">…</span>`, or a `ko`/`en`
  pair of blocks (`<ol class="ko" lang="ko">` then `<ol class="en" lang="en">`). Code names and
  identifiers stay as they are in both.
- Code links: `<a data-cite="apps/api/src/auth.ts:42-60"></a>`. An empty link shows
  `auth.ts:42-60`; text inside the link is kept. `check-cites.mjs` checks each one.
- Include a generated fragment: `<!-- include: schema.generated.html -->` (path inside `pages/`).
- Link to another tab: `<a href="#signin">`.

## Building blocks inside `.notes`
Notes run the full width; `.box` blocks sit in two columns on wide screens.
| block | use |
|---|---|
| `<h2>`, `<h3>` | sections; `<h3>name <span class="tag">GET /x</span></h3>` for a mono tag |
| `<ol>`, `<ul>`, `<p>` | prose; numbered lists only for real sequences |
| `<div class="box">` | a self-contained card (one service, one rule) |
| `<dl class="facts"><dt>…</dt><dd>…</dd></dl>` | label / value pairs |
| `<div class="watch"><strong>…</strong> …</div>` | a trap a developer must know (not a TODO) |
| `<div class="table-wrap"><table>…</table></div>` | every table; `td.num` for numbers |
| `<pre><code>…</code></pre>` | commands, config, payloads (escape `<` as `&lt;`) |
| `<details class="coll">` | collapsible block (schema tab) |

## Role tabs: "Every branch"
Under a lanes diagram, a table of every branch it draws plus the ones too small to draw:
```html
<h2><span class="ko">모든 갈림길</span><span class="en">Every branch</span></h2>
<div class="table-wrap"><table>
  <thead><tr><th><span class="ko">이럴 때</span><span class="en">When</span></th><th><span class="ko">일어나는 일</span><span class="en">What happens</span></th></tr></thead>
  <tbody>
    <tr><td>…</td><td>… the status code, the message, what the screen shows …</td></tr>
  </tbody>
</table></div>
```

## Generated tables
Big lists (HTTP routes, MCP tools, env vars, queue names) come from a small script that reads
the code at `rev` and writes `pages/<name>.generated.html`, pulled in with an include. Copy the
pattern of `gen-schema.mjs`: read with `readAtRev` / `git grep <pattern> <rev>`, keep the
`path:line` of each row, ask a notes file for the meaning of each row, list the gaps.

## Writing
- Write for a new developer who has the repo open: what it is, how it works, why it is that way.
- Short sentences, concrete names, real numbers (timeouts, limits, TTLs) with their source.
- Korean in 해요체 with easy words, never machine-translated from the English.
- No em dashes, no emoji, no filler ("robust", "seamless", "leverage", "comprehensive").
- Every claim about runtime behavior is checked in the code, not inferred from a name.
