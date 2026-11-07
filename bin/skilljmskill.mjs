#!/usr/bin/env node
// SkillJM Skill: pick the skills you want, pick your AI tool, pick where. Nothing is installed
// until you have chosen all three and said yes. No dependencies, no network, no telemetry:
// the skills ship inside this package.
//
//   npx skilljmskill                 step by step, in the terminal
//   npx skilljmskill --list          show the skills, install nothing
//   npx skilljmskill --skills debugging,devops --agent claude,codex --scope project --yes
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(PKG, 'skills');
const HOME = os.homedir();
const CWD = process.cwd();
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).version;

// Where each tool reads skills. Checked against each tool's own docs (2026-11).
const AGENTS = [
  { id: 'claude', name: 'Claude Code', user: path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'), 'skills'), project: '.claude/skills', mark: '.claude' },
  { id: 'codex', name: 'OpenAI Codex', user: path.join(HOME, '.agents', 'skills'), project: '.agents/skills', mark: '.codex' },
  { id: 'gemini', name: 'Gemini CLI', user: path.join(HOME, '.gemini', 'skills'), project: '.gemini/skills', mark: '.gemini' },
  { id: 'copilot', name: 'GitHub Copilot', user: path.join(HOME, '.copilot', 'skills'), project: '.github/skills', mark: '.copilot' },
  { id: 'cursor', name: 'Cursor', user: path.join(HOME, '.cursor', 'skills'), project: '.cursor/skills', mark: '.cursor' },
  { id: 'opencode', name: 'OpenCode', user: path.join(HOME, '.config', 'opencode', 'skills'), project: '.opencode/skills', mark: path.join('.config', 'opencode') },
];

const c = process.stdout.isTTY && !process.env.NO_COLOR
  ? { b: s => `\x1b[1m${s}\x1b[22m`, d: s => `\x1b[2m${s}\x1b[22m`, g: s => `\x1b[32m${s}\x1b[39m`, y: s => `\x1b[33m${s}\x1b[39m`, cy: s => `\x1b[36m${s}\x1b[39m`, r: s => `\x1b[31m${s}\x1b[39m` }
  : { b: s => s, d: s => s, g: s => s, y: s => s, cy: s => s, r: s => s };

function skills() {
  return fs.readdirSync(SRC, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(SRC, d.name, 'SKILL.md')))
    .map(d => {
      const text = fs.readFileSync(path.join(SRC, d.name, 'SKILL.md'), 'utf8');
      const m = text.match(/^description:\s*(.+)$/m);
      let desc = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
      desc = desc.split(/(?<=[.!?])\s/)[0];
      return { id: d.name, desc };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function args(argv) {
  const o = { skills: null, agents: null, scope: null, dir: null, yes: false, list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i] || '';
    if (a === '--list' || a === '-l') o.list = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--skills' || a === '-s') o.skills = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--agent' || a === '-a') o.agents = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--scope') o.scope = next();
    else if (a === '--dir') o.dir = next();
    else if (a === '--version' || a === '-v') { console.log(VERSION); process.exit(0); }
    else { console.error(c.r(`Unknown option ${a}`)); o.help = true; }
  }
  return o;
}

const HELP = `
${c.b('skilljmskill')} ${VERSION}  free skills for AI coding tools, from Cambodia

  install command                 choose skills, your AI tool and where, step by step
  ... --list                show every skill, install nothing

  Without questions (all three are needed, nothing has a default):
  --skills <a,b>     skill names from --list
  --agent <a,b>      ${AGENTS.map(a => a.id).join(', ')}
  --scope <s>        project  (this folder, share with your team through git)
                     user     (your home folder, every project)
  --dir <folder>     instead of --agent and --scope: put the skills in this folder
  --yes              do not ask to confirm
`;

function fit(s, w) { return s.length > w ? s.slice(0, Math.max(0, w - 1)) + '…' : s; }

// A list in the terminal: arrow keys move, space ticks, enter goes on. Nothing is ticked at the start.
function menu({ title, help, items, multi, min = 1 }) {
  return new Promise((resolve, reject) => {
    const out = process.stdout, inp = process.stdin;
    let cur = 0, top = 0, lines = 0, note = '';
    const on = new Set();
    readline.emitKeypressEvents(inp);
    inp.setRawMode(true);
    inp.resume();
    out.write('\x1b[?25l');
    const draw = () => {
      const cols = out.columns || 100, rows = Math.max(6, (out.rows || 24) - 7);
      if (cur < top) top = cur;
      if (cur >= top + rows) top = cur - rows + 1;
      const view = items.slice(top, top + rows);
      const buf = [c.b(title), c.d(help)];
      view.forEach((it, k) => {
        const i = top + k, here = i === cur;
        const box = multi ? (on.has(i) ? c.g('[x]') : '[ ]') : (here ? c.g('(o)') : '( )');
        const label = it.label.padEnd(it.pad || 0);
        // every line must fit on one row, or the redraw drifts
        const room = cols - 6 - label.length - 4;
        const tail = it.hint && room > 8 ? '  ' + c.d(fit(it.hint, room)) : '';
        buf.push(`${here ? c.cy('>') : ' '} ${box} ${here ? c.b(label) : label}${tail}`);
      });
      const more = items.length > rows ? c.d(`  ${top + 1}-${Math.min(top + rows, items.length)} of ${items.length}`) : '';
      buf.push((multi ? c.d(`  ${on.size} picked`) : '') + more + (note ? '  ' + c.y(note) : ''));
      if (lines) out.write(`\x1b[${lines}A`);
      out.write(buf.map(l => '\x1b[2K' + l).join('\n') + '\n');
      lines = buf.length;
    };
    const done = (val, err) => {
      inp.removeListener('keypress', key);
      inp.setRawMode(false);
      inp.pause();
      out.write('\x1b[?25h');
      err ? reject(err) : resolve(val);
    };
    const key = (str, k = {}) => {
      note = '';
      if (k.ctrl && k.name === 'c' || k.name === 'escape' || str === 'q') return done(null, new Error('cancel'));
      if (k.name === 'up' || str === 'k') cur = (cur - 1 + items.length) % items.length;
      else if (k.name === 'down' || str === 'j') cur = (cur + 1) % items.length;
      else if (k.name === 'pageup') cur = Math.max(0, cur - 10);
      else if (k.name === 'pagedown') cur = Math.min(items.length - 1, cur + 10);
      else if (multi && k.name === 'space') on.has(cur) ? on.delete(cur) : on.add(cur);
      else if (multi && str === 'a') { if (on.size === items.length) on.clear(); else items.forEach((_, i) => on.add(i)); }
      else if (k.name === 'return') {
        if (!multi) return done(items[cur].value);
        if (on.size < min) note = 'Press space to tick at least one first.';
        else return done([...on].sort((x, y) => x - y).map(i => items[i].value));
      }
      draw();
    };
    inp.on('keypress', key);
    draw();
  });
}

function ask(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a.trim()); });
  });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

function install(names, dirs) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  for (const dest of dirs) {
    fs.mkdirSync(dest, { recursive: true });
    let moved = false;
    for (const n of names) {
      const to = path.join(dest, n);
      if (fs.existsSync(to)) {
        const bk = path.join(dest, '.skilljmskill-backup', stamp);
        fs.mkdirSync(bk, { recursive: true });
        fs.renameSync(to, path.join(bk, n));
        moved = true;
      }
      copyDir(path.join(SRC, n), to);
    }
    console.log(`${c.g('done')}  ${names.length} skill(s) in ${dest}`);
    if (moved) console.log(c.d(`      skills you already had there were moved to .skilljmskill-backup/${stamp}, not deleted`));
  }
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.help) { console.log(HELP); return; }
  const all = skills();
  if (o.list) {
    const w = Math.max(...all.map(s => s.id.length));
    all.forEach(s => console.log(`${c.b(s.id.padEnd(w))}  ${c.d(fit(s.desc, (process.stdout.columns || 120) - w - 3))}`));
    console.log(c.d(`\n${all.length} skills. Install some with the command on https://daraboth.github.io/skilljmskill/`));
    return;
  }

  const tty = process.stdin.isTTY && process.stdout.isTTY;
  if (!tty && !(o.skills && (o.dir || (o.agents && o.scope)))) {
    console.error('This terminal cannot show the menu, and nothing is installed without your choice.');
    console.error('Name the skills, the AI tool and where yourself, for example:');
    console.error('  ... --skills debugging,devops --agent claude --scope project --yes');
    process.exit(1);
  }

  console.log(`\n${c.b('SkillJM Skill')} ${c.d(VERSION)}  ${c.d('nothing is installed until you confirm at the end')}\n`);

  // 1. Skills
  let names = o.skills;
  if (names) {
    const bad = names.filter(n => !all.some(s => s.id === n));
    if (bad.length) { console.error(c.r(`Not a skill here: ${bad.join(', ')}. See --list.`)); process.exit(1); }
  } else {
    const w = Math.max(...all.map(s => s.id.length));
    names = await menu({
      title: 'Step 1 of 3. Which skills do you want?',
      help: 'up/down move   space tick   a all/none   enter next   q quit',
      items: all.map(s => ({ label: s.id, pad: w, hint: s.desc, value: s.id })), multi: true,
    });
    console.log('');
  }

  // 2 and 3. AI tool and place, or one folder
  let dirs;
  if (o.dir) dirs = [path.resolve(o.dir)];
  else {
    let agents = o.agents;
    if (agents) {
      const bad = agents.filter(a => !AGENTS.some(x => x.id === a));
      if (bad.length) { console.error(c.r(`Unknown AI tool: ${bad.join(', ')}. Use: ${AGENTS.map(a => a.id).join(', ')}`)); process.exit(1); }
    } else {
      agents = await menu({
        title: 'Step 2 of 3. Which AI tool do you use? Tick every one you want the skills in.',
        help: 'up/down move   space tick   enter next   q quit   (found = its folder exists on this computer)',
        items: [...AGENTS.map(a => ({ label: a.name, pad: 16, hint: fs.existsSync(path.join(HOME, a.mark)) ? 'found' : '', value: a.id })),
          { label: 'Another tool', pad: 16, hint: 'you type the folder it reads skills from', value: 'other' }],
        multi: true,
      });
      console.log('');
    }
    let scope = o.scope;
    if (agents.includes('other')) {
      const d = await ask('Folder for the other tool (it will get one folder per skill): ');
      if (!d) { console.error(c.r('No folder given, nothing installed.')); process.exit(1); }
      dirs = [path.resolve(d)];
      agents = agents.filter(a => a !== 'other');
    } else dirs = [];
    if (agents.length) {
      if (scope && !['user', 'project'].includes(scope)) { console.error(c.r('--scope is user or project')); process.exit(1); }
      if (!scope) {
        scope = await menu({
          title: 'Step 3 of 3. Install where?',
          help: 'up/down move   enter choose   q quit',
          items: [
            { label: 'This project only', pad: 18, hint: `${CWD}  (commit it to share with your team)`, value: 'project' },
            { label: 'Me, every project', pad: 18, hint: `your home folder ${HOME}`, value: 'user' },
          ], multi: false,
        });
        console.log('');
      }
      const sel = AGENTS.filter(a => agents.includes(a.id));
      dirs.push(...sel.map(a => scope === 'user' ? a.user : path.join(CWD, a.project)));
    }
    dirs = [...new Set(dirs)];
  }

  // Confirm
  console.log(c.b('Ready to install'));
  console.log(`  skills  ${names.join(', ')}`);
  dirs.forEach(d => console.log(`  into    ${d}`));
  if (!o.yes) {
    const a = await ask('\nInstall now? (y/N) ');
    if (!/^y(es)?$/i.test(a)) { console.log('Nothing installed.'); return; }
  }
  install(names, dirs);
  console.log(`\nRestart your AI tool, then ask it for the skill by name, for example ${c.cy('/' + names[0])} in Claude Code.`);
  console.log(c.d('បិទកម្មវិធី AI ហើយបើកវាឡើងវិញ ដើម្បីប្រើ skill ថ្មី។'));
}

main().catch(e => {
  process.stdout.write('\x1b[?25h');
  if (e && e.message === 'cancel') { console.log('\nCancelled. Nothing installed.'); process.exit(130); }
  console.error(c.r(e && e.stack || String(e)));
  process.exit(1);
});
