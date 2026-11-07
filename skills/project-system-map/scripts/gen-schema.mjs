// Generates the Database schema tab body from the schema files at config.rev, never by hand.
// Meanings come from schema-notes.mjs; this script lists every table, field and index that
// still lacks one. Output: pages/schema.generated.html, pulled into pages/schema.html with
// <!-- include: schema.generated.html -->.
//
//   node gen-schema.mjs --sql "supabase/migrations/*.sql"   Postgres migrations, applied in name order
//   node gen-schema.mjs --prisma prisma/schema.prisma
//   node gen-schema.mjs --json schema.json                   anything else: write a small adapter
//                                                            that emits this shape (references/schema-tab.md)
//   add --allow-gaps to write the file even when meanings are missing
import fs from 'node:fs';
import path from 'node:path';
import { WORK, load, pick, esc, both, readAtRev, git, isWorktree, repoDir, citeHref, parseCite, citeName } from './lib.mjs';

const config = await load('map-config.mjs');
const notes = await load('schema-notes.mjs', {});
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const allowGaps = args.includes('--allow-gaps');
const outFile = path.join(WORK, opt('--out') || 'pages/schema.generated.html');

// ---------- files at rev ----------
function listRepoFiles() {
  if (isWorktree(config)) {
    const root = repoDir(config);
    const out = [];
    const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (f.name === '.git' || f.name === 'node_modules') continue; const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else out.push(path.relative(root, p).split(path.sep).join('/')); } };
    walk(root);
    return out;
  }
  return git(config, ['ls-tree', '-r', '--name-only', config.rev]).split('\n').filter(Boolean);
}
// "*" stays inside one folder, "**/" crosses any number of folders.
function globToRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { re += '(?:.*/)?'; i++; if (g[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// ---------- rules, in plain words ----------
const R = {
  required: { ko: '필수', en: 'required' },
  optional: { ko: '없어도 돼요', en: 'optional' },
  pk: { ko: '기본 키', en: 'primary key' },
  unique: { ko: '유일', en: 'unique' },
  def: (v) => ({ ko: `기본값 ${v}`, en: `default ${v}` }),
  ref: (t, c) => ({ ko: `${t}.${c} 를 가리켜요`, en: `points to ${t}.${c}` }),
  cascade: { ko: '가리키는 행이 지워지면 같이 지워져요', en: 'deleted with the row it points to' },
  setNull: { ko: '가리키는 행이 지워지면 비워져요', en: 'cleared when the row it points to is deleted' },
  check: (c) => ({ ko: `검사 ${c}`, en: `check ${c}` }),
  generated: { ko: 'DB 가 계산해요', en: 'computed by the database' },
  list: { ko: '목록', en: 'list' },
};
const IDX = {
  unique: { ko: '유일', en: 'unique' },
  index: { ko: '색인', en: 'index' },
  pk: { ko: '기본 키', en: 'primary key' },
  partial: (w) => ({ ko: `조건 ${w}`, en: `where ${w}` }),
  using: (m) => ({ ko: `${m} 방식`, en: `${m} method` }),
};

// ---------- SQL ----------
function splitStatements(text) {
  const out = [];
  let start = 0, i = 0, depth = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'") { i++; while (i < n && !(text[i] === "'" && text[i + 1] !== "'")) { if (text[i] === "'") i++; i++; } i++; continue; }
    if (c === '"') { const e = text.indexOf('"', i + 1); i = e < 0 ? n : e + 1; continue; }
    if (c === '$') { const m = /^\$[A-Za-z_]*\$/.exec(text.slice(i)); if (m) { const e = text.indexOf(m[0], i + m[0].length); i = e < 0 ? n : e + m[0].length; continue; } }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth <= 0) { out.push({ text: text.slice(start, i), at: start }); start = i + 1; depth = 0; }
    i++;
  }
  if (text.slice(start).trim()) out.push({ text: text.slice(start), at: start });
  return out;
}
function stripComments(s) { return s.replace(/--[^\n]*/g, (m) => ' '.repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')); }
function splitTop(s) {
  const parts = []; let depth = 0, start = 0, q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") q = !q;
    if (q) continue;
    if (c === '(') depth++; else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push({ text: s.slice(start, i), at: start }); start = i + 1; }
  }
  parts.push({ text: s.slice(start), at: start });
  return parts;
}
const unq = (s) => s.replace(/"/g, '').trim();
const bare = (s) => unq(s).split('.').pop();
const STOP = /\s(NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|GENERATED|CONSTRAINT|COLLATE)\b/i;
function columnDef(def) {
  const m = /^\s*("[^"]+"|[A-Za-z_][\w$]*)\s+([\s\S]+)$/.exec(def);
  if (!m) return null;
  const rest = ' ' + m[2].trim();
  const stop = rest.search(STOP);
  const type = (stop < 0 ? rest : rest.slice(0, stop)).trim().replace(/\s+/g, ' ');
  const tail = stop < 0 ? '' : rest.slice(stop);
  const rules = [];
  if (/\bPRIMARY\s+KEY\b/i.test(tail)) rules.push(R.pk);
  else if (/\bNOT\s+NULL\b/i.test(tail)) rules.push(R.required);
  if (/\bUNIQUE\b/i.test(tail)) rules.push(R.unique);
  const d = /\bDEFAULT\s+((?:'[^']*'|\([^)]*\)|[^\s,])+(?:\s*\([^)]*\))?)/i.exec(tail);
  if (d) rules.push(R.def(d[1]));
  const ref = /\bREFERENCES\s+("?[\w.]+"?)\s*(?:\(\s*("?\w+"?)\s*\))?/i.exec(tail);
  if (ref) rules.push(R.ref(bare(ref[1]), ref[2] ? unq(ref[2]) : 'id'));
  if (/ON\s+DELETE\s+CASCADE/i.test(tail)) rules.push(R.cascade);
  if (/ON\s+DELETE\s+SET\s+NULL/i.test(tail)) rules.push(R.setNull);
  const ck = /\bCHECK\s*(\((?:[^()]|\([^()]*\))*\))/i.exec(tail);
  if (ck) rules.push(R.check(ck[1].replace(/\s+/g, ' ')));
  if (/\bGENERATED\b/i.test(tail)) rules.push(R.generated);
  return { name: unq(m[1]), type, rules };
}

function parseSql(files) {
  const tables = new Map();
  const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;
  for (const file of files) {
    const raw = readAtRev(config, file);
    if (raw == null) { console.error(`cannot read ${file}`); continue; }
    const text = stripComments(raw);
    for (const st of splitStatements(text)) {
      const s = st.text;
      const lead = st.at + (s.length - s.trimStart().length);
      const line = lineAt(text, lead);
      let m;
      if ((m = /^\s*CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)\s*\(([\s\S]*)\)\s*[^)]*$/i.exec(s))) {
        const name = bare(m[1]);
        const bodyAt = st.at + s.indexOf(m[2]);
        const t = { name, defined: `${file}:${line}`, fields: [], indexes: [] };
        for (const part of splitTop(m[2])) {
          const p = part.text.trim();
          if (!p) continue;
          const pline = lineAt(text, bodyAt + part.at + (part.text.length - part.text.trimStart().length));
          let c;
          if ((c = /^(?:CONSTRAINT\s+("?\w+"?)\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(p))) t.indexes.push({ name: c[1] ? unq(c[1]) : `${name}_pkey`, fields: c[2].split(',').map(unq), kind: [IDX.pk], at: `${file}:${pline}` });
          else if ((c = /^(?:CONSTRAINT\s+("?\w+"?)\s+)?UNIQUE\s*\(([^)]+)\)/i.exec(p))) t.indexes.push({ name: c[1] ? unq(c[1]) : `${name}_${c[2].split(',').map(unq).join('_')}_key`, fields: c[2].split(',').map(unq), kind: [IDX.unique], at: `${file}:${pline}` });
          else if (/^(CONSTRAINT|FOREIGN\s+KEY|CHECK|EXCLUDE|LIKE)\b/i.test(p)) continue;
          else {
            const col = columnDef(p);
            if (col) {
              col.at = `${file}:${pline}`;
              t.fields.push(col);
              if (col.rules.includes(R.pk)) t.indexes.push({ name: `${name}_pkey`, fields: [col.name], kind: [IDX.pk], at: col.at });
              if (col.rules.includes(R.unique)) t.indexes.push({ name: `${name}_${col.name}_key`, fields: [col.name], kind: [IDX.unique], at: col.at });
            }
          }
        }
        tables.set(name, t);
      } else if ((m = /^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?("?[\w.]+"?)\s+([\s\S]+)$/i.exec(s))) {
        const t = tables.get(bare(m[1]));
        if (!t) continue;
        const actsAt = st.at + s.indexOf(m[2]);
        for (const part of splitTop(m[2])) {
          const a = part.text.trim();
          const aline = lineAt(text, actsAt + part.at + (part.text.length - part.text.trimStart().length));
          let c;
          if ((c = /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]+)$/i.exec(a)) && !/^ADD\s+(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i.test(a)) {
            const col = columnDef(c[1]);
            if (col) { col.at = `${file}:${aline}`; t.fields = t.fields.filter((f) => f.name !== col.name).concat(col); }
          } else if ((c = /^ADD\s+CONSTRAINT\s+("?\w+"?)\s+UNIQUE\s*\(([^)]+)\)/i.exec(a))) {
            t.indexes.push({ name: unq(c[1]), fields: c[2].split(',').map(unq), kind: [IDX.unique], at: `${file}:${aline}` });
          } else if ((c = /^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i.exec(a))) {
            t.fields = t.fields.filter((f) => f.name !== unq(c[1]));
          } else if ((c = /^RENAME\s+COLUMN\s+("?\w+"?)\s+TO\s+("?\w+"?)/i.exec(a))) {
            const f = t.fields.find((x) => x.name === unq(c[1])); if (f) f.name = unq(c[2]);
          } else if ((c = /^ALTER\s+COLUMN\s+("?\w+"?)\s+SET\s+NOT\s+NULL/i.exec(a))) {
            const f = t.fields.find((x) => x.name === unq(c[1])); if (f && !f.rules.includes(R.required)) f.rules.unshift(R.required);
          } else if ((c = /^ALTER\s+COLUMN\s+("?\w+"?)\s+DROP\s+NOT\s+NULL/i.exec(a))) {
            const f = t.fields.find((x) => x.name === unq(c[1])); if (f) f.rules = f.rules.filter((r) => r !== R.required);
          } else if ((c = /^RENAME\s+TO\s+("?\w+"?)/i.exec(a))) {
            tables.delete(t.name); t.name = unq(c[1]); tables.set(t.name, t);
          }
        }
      } else if ((m = /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?)\s+ON\s+(?:ONLY\s+)?("?[\w.]+"?)\s*(?:USING\s+(\w+)\s*)?\(([\s\S]+?)\)\s*(?:INCLUDE\s*\([^)]*\)\s*)?(?:WHERE\s+([\s\S]+))?$/i.exec(s))) {
        const t = tables.get(bare(m[3]));
        if (!t) continue;
        const kind = [m[1] ? IDX.unique : IDX.index];
        if (m[4] && m[4].toLowerCase() !== 'btree') kind.push(IDX.using(m[4]));
        if (m[6]) kind.push(IDX.partial(m[6].trim().replace(/\s+/g, ' ')));
        t.indexes = t.indexes.filter((x) => x.name !== unq(m[2]));
        t.indexes.push({ name: unq(m[2]), fields: splitTop(m[5]).map((p) => p.text.trim().replace(/\s+/g, ' ')), kind, at: `${file}:${line}` });
      } else if ((m = /^\s*DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/i.exec(s))) {
        for (const t of tables.values()) t.indexes = t.indexes.filter((x) => x.name !== bare(m[1]));
      } else if ((m = /^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/i.exec(s))) {
        tables.delete(bare(m[1]));
      }
    }
  }
  return [...tables.values()];
}

// ---------- Prisma ----------
function parsePrisma(file) {
  const raw = readAtRev(config, file);
  if (raw == null) { console.error(`cannot read ${file}`); return []; }
  const lines = raw.split('\n');
  const out = [];
  let t = null;
  lines.forEach((ln, i) => {
    const s = ln.replace(/\/\/.*$/, '').trim();
    let m;
    if ((m = /^model\s+(\w+)\s*\{/.exec(s))) { t = { name: m[1], defined: `${file}:${i + 1}`, fields: [], indexes: [] }; out.push(t); return; }
    if (!t) return;
    if (s === '}') { t = null; return; }
    if ((m = /^@@map\("([^"]+)"\)/.exec(s))) { t.name = m[1]; return; }
    if ((m = /^@@(unique|index|id)\(\[([^\]]+)\]/.exec(s))) {
      const fields = m[2].split(',').map((x) => x.trim().replace(/\(.*$/, ''));
      t.indexes.push({ name: (/name:\s*"([^"]+)"/.exec(s) || [])[1] || `${t.name}_${fields.join('_')}_${m[1]}`, fields, kind: [m[1] === 'unique' ? IDX.unique : m[1] === 'id' ? IDX.pk : IDX.index], at: `${file}:${i + 1}` });
      return;
    }
    if ((m = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(s))) {
      const [, name, type, list, opt, attrs] = m;
      if (/@relation/.test(attrs) && !/fields:/.test(attrs)) return; // back-relation, no column
      const rules = [];
      if (/@id\b/.test(attrs)) rules.push(R.pk); else if (!opt && !list) rules.push(R.required); else rules.push(R.optional);
      if (/@unique\b/.test(attrs)) rules.push(R.unique);
      const d = /@default\(((?:[^()]|\([^()]*\))*)\)/.exec(attrs);
      if (d) rules.push(R.def(d[1]));
      if (list) rules.push(R.list);
      const rel = /@relation\([^)]*references:\s*\[(\w+)\]/.exec(attrs);
      if (rel) rules.push(R.ref(type, rel[1]));
      if (/onDelete:\s*Cascade/.test(attrs)) rules.push(R.cascade);
      t.fields.push({ name, type: type + (list || '') + (opt || ''), rules, at: `${file}:${i + 1}` });
      if (/@id\b/.test(attrs)) t.indexes.push({ name: `${t.name}_pkey`, fields: [name], kind: [IDX.pk], at: `${file}:${i + 1}` });
      if (/@unique\b/.test(attrs)) t.indexes.push({ name: `${t.name}_${name}_key`, fields: [name], kind: [IDX.unique], at: `${file}:${i + 1}` });
    }
  });
  return out;
}

// ---------- pick the source ----------
let tables = [];
if (opt('--sql')) {
  const re = globToRe(opt('--sql'));
  const files = listRepoFiles().filter((f) => re.test(f)).sort();
  if (!files.length) { console.error(`no files match ${opt('--sql')}`); process.exit(1); }
  tables = parseSql(files);
  console.log(`read ${files.length} SQL files`);
} else if (opt('--prisma')) tables = parsePrisma(opt('--prisma'));
else if (opt('--json')) tables = JSON.parse(fs.readFileSync(path.join(WORK, opt('--json')), 'utf8')).tables;
else { console.error('pass --sql <glob>, --prisma <file> or --json <file>'); process.exit(1); }
if (config.schemaTables) tables = tables.filter((t) => config.schemaTables.includes(t.name));
tables.sort((a, b) => a.name.localeCompare(b.name));

// ---------- render ----------
const gaps = [];
const link = (cite) => {
  const ci = parseCite(cite);
  return ci.bad ? esc(cite) : `<a href="${esc(citeHref(config, ci))}" target="_blank" rel="noopener">${esc(citeName(ci))}</a>`;
};
const ruleList = (rules) => (rules || []).map((r) => (typeof r === 'string' ? `<code>${esc(r)}</code>` : both(r))).join(', ');
const html = [];
for (const t of tables) {
  const n = notes[t.name] || {};
  if (!n.about) gaps.push(`${t.name}: what the table is for`);
  const fieldRows = t.fields.map((f) => {
    const meaning = n.fields && n.fields[f.name];
    if (!meaning) gaps.push(`${t.name}.${f.name}: meaning`);
    return `<tr><td><code>${esc(f.name)}</code></td><td><code>${esc(f.type)}</code></td><td>${ruleList(f.rules)}</td><td>${meaning ? both(meaning) : ''}</td></tr>`;
  });
  const idxRows = (t.indexes || []).map((x) => {
    const why = n.indexes && n.indexes[x.name];
    if (!why) gaps.push(`${t.name} index ${x.name}: why it exists`);
    return `<tr><td>${x.fields.map((f) => `<code>${esc(f)}</code>`).join(', ')}</td><td>${ruleList(x.kind)}, <code>${esc(x.name)}</code></td><td>${why ? both(why) : ''}</td></tr>`;
  });
  html.push(`<details class="coll" id="col-${esc(t.name)}">
<summary><code>${esc(t.name)}</code> ${n.about ? both(n.about) : ''}</summary>
<div class="coll-body">
<p class="meta">${both({ ko: '정의', en: 'Defined in' })} ${link(n.defined || t.defined)} · ${both({ ko: `필드 ${t.fields.length}개`, en: `${t.fields.length} field${t.fields.length === 1 ? '' : 's'}` })}</p>
<div class="table-wrap"><table class="schema"><thead><tr><th>${both({ ko: '필드', en: 'Field' })}</th><th>${both({ ko: '타입', en: 'Type' })}</th><th>${both({ ko: '규칙', en: 'Rules' })}</th><th>${both({ ko: '뜻', en: 'Meaning' })}</th></tr></thead><tbody>
${fieldRows.join('\n')}
</tbody></table></div>${idxRows.length ? `
<h4>${both({ ko: '색인', en: 'Indexes' })}</h4>
<div class="table-wrap"><table class="schema-idx"><thead><tr><th>${both({ ko: '필드', en: 'Fields' })}</th><th>${both({ ko: '종류', en: 'Kind' })}</th><th>${both({ ko: '이유', en: 'Why' })}</th></tr></thead><tbody>
${idxRows.join('\n')}
</tbody></table></div>` : ''}
</div>
</details>`);
}
for (const k of Object.keys(notes)) if (!tables.some((t) => t.name === k)) console.warn(`note: schema-notes.mjs describes "${k}", which is not in the schema`);

const fieldCount = tables.reduce((s, t) => s + t.fields.length, 0);
const idxCount = tables.reduce((s, t) => s + (t.indexes || []).length, 0);
if (gaps.length) {
  gaps.forEach((g) => console.log('  missing: ' + g));
  console.log(`${gaps.length} meanings missing in schema-notes.mjs`);
}
if (gaps.length && !allowGaps) { process.exitCode = 1; console.log('not written (pass --allow-gaps to write anyway)'); }
else {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html.join('\n') + '\n');
  console.log(`wrote ${path.relative(WORK, outFile)}: ${tables.length} tables, ${fieldCount} fields, ${idxCount} indexes`);
}
