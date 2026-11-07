// Checks every code citation: diagram src lists, details.mjs, map-explain.mjs, data-cite links in
// pages/*.html and schema-notes.mjs. A citation is good when the file exists at config.rev and the
// line range is inside it. Also checks that config.rev is pushed (on a remote branch), because an
// unpushed commit makes every GitHub link 404.
//   node check-cites.mjs          prints problems, exits 1 if any
import fs from 'node:fs';
import path from 'node:path';
import { WORK, loadAll, load, parseCite, readAtRev, git, isWorktree, listFiles, clickables } from './lib.mjs';

const { config, maps, details, explain } = await loadAll();
const schemaNotes = await load('schema-notes.mjs', {});
const problems = [];
const cites = []; // { where, cite }

function collect(where, list) { (list || []).forEach((c) => cites.push({ where, cite: c })); }

for (const [name, map] of Object.entries(maps)) {
  for (const item of clickables(map)) collect(`map ${name}.${item.id}`, item.src);
}
for (const [set, entries] of Object.entries(details)) {
  for (const [key, d] of Object.entries(entries || {})) collect(`details ${set}.${key}`, d && d.src);
}
for (const [key, d] of Object.entries(explain)) collect(`map-explain ${key}`, d && d.src);
for (const [table, t] of Object.entries(schemaNotes)) {
  if (t && t.defined) collect(`schema-notes ${table}`, [t.defined]);
}
for (const file of listFiles(path.join(WORK, 'pages'), '.html')) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /data-cite="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const line = html.slice(0, m.index).split('\n').length;
    cites.push({ where: `${path.basename(file)}:${line}`, cite: m[1] });
  }
}

// The commit itself
if (isWorktree(config)) {
  console.log('note: rev is WORKTREE, so files are read from the working tree and links are not tied to a pushed commit.');
} else {
  try {
    git(config, ['cat-file', '-e', `${config.rev}^{commit}`]);
    const remotes = git(config, ['branch', '-r', '--contains', config.rev]).trim();
    if (!remotes) problems.push(`rev ${config.rev.slice(0, 12)} is not on any remote branch. Push it (or pick a pushed sha) or every link 404s.`);
  } catch {
    problems.push(`rev ${config.rev} is not a commit in ${config.repoPath || '.'} (run git fetch?)`);
  }
}

let checked = 0;
const unique = new Set();
for (const { where, cite } of cites) {
  const ci = parseCite(cite);
  if (ci.bad) { problems.push(`${where}: "${ci.raw}" is ${ci.bad}`); continue; }
  unique.add(`${ci.path}:${ci.from}-${ci.to}`);
  const text = readAtRev(config, ci.path);
  checked++;
  if (text == null) { problems.push(`${where}: ${ci.path} does not exist at ${isWorktree(config) ? 'the working tree' : config.rev.slice(0, 12)}`); continue; }
  const n = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (ci.from < 1 || ci.to > n || ci.from > ci.to) problems.push(`${where}: ${ci.raw} is outside the file (${n} lines)`);
}

for (const p of problems) console.log('  ' + p);
console.log(`${checked} citations checked (${unique.size} unique), ${problems.length} problems`);
fs.mkdirSync(path.join(WORK, 'out'), { recursive: true });
fs.writeFileSync(path.join(WORK, 'out', 'cite-count.json'), JSON.stringify({ checked, unique: unique.size, problems: problems.length }));
if (problems.length) process.exitCode = 1;
