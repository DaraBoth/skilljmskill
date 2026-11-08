# -*- coding: utf-8 -*-
"""Build the GitHub Pages site from every skills/<name>/SKILL.md.

    python tools/build_site.py

Writes:
  index.html             the overview: install command, search, picker, every skill by group
  s/<name>.html          one page per skill: what it does, when to use it, needs, install, download
  downloads/<name>.zip   the skill folder, ready to unzip into an AI tool's skills folder

Hand-written files it links to (edit them directly): assets/site.css, assets/site.js.
The plain-English text for each skill page lives in tools/skill_notes.py.
Run it after adding or changing a skill, then commit the results.
"""
import html
import io
import os
import re
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skill_notes import NOTES  # noqa: E402

SITE = 'https://daraboth.github.io/skilljmskill'
REPO = 'https://github.com/DaraBoth/skilljmskill'
ZIP_TIME = (2024, 1, 1, 0, 0, 0)  # fixed, so a rebuild does not change zips that did not change

GROUPS = [
    ('coding', 'Coding and debugging', 'សរសេរកូដ និងដោះស្រាយបញ្ហា',
     ['debugging', 'javascript', 'java', 'cmd', 'devops', 'system-design', 'code-explainer-page', 'project-system-map']),
    ('ai', 'Working with AI', 'ធ្វើការជាមួយ AI',
     ['ai-usage', 'prompt-templates', 'team-workflow', 'skill-creation', 'auto-handoff', 'talk-to-sessions', 'orbit-task', 'html-work-report', 'second-brain']),
    ('orbit', 'An AI team on Orbit', 'ក្រុម AI លើ Orbit',
     ['pm-loop', 'dev-loop', 'review-loop', 'qa-loop', 'customer-loop']),
    ('design', 'Design and UI', 'រចនា និង UI',
     ['frontend-design', 'ui-design-principles', 'ui-color-palettes']),
    ('3d', '3D on the web', '3D លើវេបសាយ',
     ['3d-web-experience', 'threejs-fundamentals', 'threejs-geometry', 'threejs-materials', 'threejs-textures',
      'threejs-lighting', 'threejs-loaders', 'threejs-animation', 'threejs-interaction', 'threejs-shaders',
      'threejs-postprocessing', 'threejs-performance', 'threejs-asset-pipeline', 'threejs-react-three-fiber']),
    ('life', 'Study, career and your computer', 'ការសិក្សា អាជីព និងកុំព្យូទ័រ',
     ['learning', 'productivity', 'career', 'disk-cleanup', 'computer-control']),
]

GROUP_NOTES = {
    'orbit': 'Five agents that work together through one Orbit board, each in its own terminal. '
             'You answer their questions from your phone. Set up Orbit with orbit-task first.',
    '3d': 'The threejs skills are by CloudAI-X (MIT). 3d-web-experience is from vibeship-spawner-skills (Apache-2.0).',
}

# Where each AI tool looks for skills (same table as the README).
TOOLS = [
    ('Claude Code', '.claude/skills', '~/.claude/skills'),
    ('OpenAI Codex', '.agents/skills', '~/.agents/skills'),
    ('Gemini CLI', '.gemini/skills', '~/.gemini/skills'),
    ('GitHub Copilot', '.github/skills', '~/.copilot/skills'),
    ('Cursor', '.cursor/skills', '~/.cursor/skills'),
    ('OpenCode', '.opencode/skills', '~/.config/opencode/skills'),
]

esc = html.escape


# ---------- reading skills ----------

def frontmatter_description(text):
    m = re.search(r'^description:\s*(.*)$', text, re.M)
    if not m:
        return ''
    d = m.group(1).strip()
    if d in ('>', '|', '>-', '|-', ''):
        lines = []
        for line in text[m.end():].split('\n')[1:]:
            if line.startswith((' ', '\t')):
                lines.append(line.strip())
            else:
                break
        d = ' '.join(lines)
    return d.strip().strip('"').strip("'")


def plain(s):
    """No em dashes, no emoji, tidy spaces."""
    s = s.replace(' — ', ': ').replace('—', ', ').replace(' – ', ', ')
    s = re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def short_line(d):
    d = plain(re.split(r'(?<=[.!?])\s', d)[0])
    return d if len(d) <= 170 else d[:167].rstrip() + '...'


def inside_headings(text):
    out = []
    for line in text.split('\n'):
        if line.startswith('## '):
            h = plain(line[3:].strip('# ').strip())
            h = re.sub(r'^\d+\.\s*', '', h).replace('`', '')
            h = re.sub(r'\s*\(.*?\)\s*$', '', h)
            if h and h.lower() not in ('key takeaways', 'details', 'related pages', 'see also') and h not in out:
                out.append(h)
    return out[:9]


def tracked_files(name):
    rel = 'skills/' + name
    try:
        out = subprocess.run(['git', 'ls-files', '-z', rel], cwd=ROOT, capture_output=True, check=True).stdout
        files = [f for f in out.decode('utf-8').split('\0') if f]
    except (OSError, subprocess.CalledProcessError):
        files = []
    if not files:  # not a git checkout, or a new skill not added yet
        for base, _, names in os.walk(os.path.join(ROOT, rel)):
            for n in names:
                files.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/'))
    return sorted(f for f in files if os.path.isfile(os.path.join(ROOT, f)))


def fallback_note(desc):
    """For a skill with no entry in skill_notes.py: build the page from its description."""
    sentences = re.split(r'(?<=[.!?])\s', plain(desc))
    about = ' '.join(s for s in sentences if not re.match(r'(Use|Trigger|Triggers)\b', s)) or plain(desc)
    uses = [plain(q) for q in re.findall(r'"([^"]{6,90})"', desc)][:5]
    return dict(about=about, km='', uses=uses, needs=[], tags=[])


def load_skill(name):
    text = io.open(os.path.join(ROOT, 'skills', name, 'SKILL.md'), encoding='utf-8').read()
    desc = frontmatter_description(text)
    note = dict(fallback_note(desc))
    note.update(NOTES.get(name, {}))
    files = tracked_files(name)
    extras = sorted({f.split('/')[2] for f in files if f.count('/') >= 3})
    return dict(name=name, desc=desc, line=short_line(desc), note=note, inside=inside_headings(text),
                files=files, extras=extras, tags=note.get('tags', []))


def write_zip(skill):
    os.makedirs(os.path.join(ROOT, 'downloads'), exist_ok=True)
    path = os.path.join(ROOT, 'downloads', skill['name'] + '.zip')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in skill['files']:
            info = zipfile.ZipInfo(f[len('skills/'):], date_time=ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if f.endswith(('.sh', '.mjs', '.py')) else 0o644) << 16
            with open(os.path.join(ROOT, f), 'rb') as fh:
                z.writestr(info, fh.read())
    return os.path.getsize(path)


def first_sentence(text):
    return re.split(r'(?<=[.!?])\s', text)[0]


def kb(n):
    return f'{max(1, round(n / 1024))} KB'


# ---------- HTML pieces ----------

ICONS = '''<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></symbol>
<symbol id="i-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
<symbol id="i-right" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/></symbol>
<symbol id="i-folder" viewBox="0 0 24 24"><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
</svg>'''


def icon(name, cls='ic'):
    return f'<svg class="{cls}" aria-hidden="true" focusable="false"><use href="#i-{name}"/></svg>'


def head(title, desc, url, base):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#1C3AA9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1430" media="(prefers-color-scheme: dark)">
<script>try{{var t=localStorage.getItem('sjm-theme');if(t)document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,600..800&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&family=Atkinson+Hyperlegible+Mono:wght@400;600&family=Kantumruy+Pro:wght@400;600&display=swap">
<link rel="stylesheet" href="{base}assets/site.css">
</head>'''


def topbar(base, back=False):
    left = (f'<a class="back" href="{base}index.html#skills" aria-label="All skills">{icon("left")}<span>All skills</span></a>' if back else '')
    return f'''<div class="bar wrap">
    <a class="brand" href="{base}index.html"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span>SkillJM Skill</a>
    {left}
    <span class="bar-gap"></span>
    <a class="bar-link" href="{REPO}">GitHub</a>
    <button class="theme" type="button" aria-label="Switch light or dark">{icon("moon", "ic ic-moon")}{icon("sun", "ic ic-sun")}</button>
  </div>'''


def os_switch(label_id):
    return f'''<div class="os" role="group" aria-labelledby="{label_id}">
        <span class="os-label" id="{label_id}">Your computer <span class="km">កុំព្យូទ័ររបស់អ្នក</span></span>
        <button type="button" data-os="win" aria-pressed="true">Windows</button>
        <button type="button" data-os="nix" aria-pressed="false">Mac / Linux</button>
      </div>'''


def cmd_block(code_id, text=None, js=False):
    inner = '' if js else esc(text)
    return (f'<div class="cmd"><code id="{code_id}">{inner}</code>'
            f'<button class="copy" type="button" data-copy="{code_id}">{icon("copy")}<span>Copy</span></button></div>')


def folder_table(name=None):
    rows = ''.join(f'<tr><th scope="row">{t}</th><td data-label="This project only"><code>{p}</code></td>'
                   f'<td data-label="You, every project"><code>{u}</code></td></tr>'
                   for t, p, u in TOOLS)
    example = (f'<code>.claude/skills/{name}/SKILL.md</code>' if name
               else '<code>.claude/skills/debugging/SKILL.md</code>')
    return f'''<div class="table-wrap" tabindex="0" role="region" aria-label="Skills folder for each AI tool">
      <table class="folders">
        <thead><tr><th scope="col">AI tool</th><th scope="col">This project only</th><th scope="col">You, every project</th></tr></thead>
        <tbody>{rows}</tbody>
      </table></div>
      <p class="note">Unzip so the folder sits inside, for example {example}. Make the <code>skills</code> folder if it is not there.
      On Windows, <code>~</code> is your user folder, for example <code>C:\\Users\\you</code>. Then close your AI tool and open it again.<br>
      <span class="km">ពន្លាឯកសារ zip ចូលក្នុង folder skills នៃកម្មវិធី AI របស់អ្នក រួចបិទ ហើយបើកកម្មវិធីនោះឡើងវិញ។</span></p>'''


FOOTER = f'''<footer class="foot"><div class="wrap">
  <p>Free and open source. Our own skills are MIT; skills from other authors keep their own licence inside their folder.
  <a href="{REPO}">Source on GitHub</a>. Found a mistake, or want to add a skill in Khmer? Open an issue or a pull request.</p>
  <p class="km">ឥតគិតថ្លៃ និងជាកូដចំហ។ រកឃើញកំហុស ឬចង់បន្ថែម skill ជាភាសាខ្មែរ? សូមបើក issue ឬ pull request។</p>
</div></footer>'''


def tag_html(tags):
    return ''.join(f'<span class="tag">{esc(t)}</span>' for t in tags)


# ---------- overview ----------

def build_index(groups, skills, count):
    nav = ''.join(f'<a href="#g-{gid}">{esc(en)} <span class="n">{len(ns)}</span></a>' for gid, en, _, ns in groups)
    sections = []
    for gid, en, km, ns in groups:
        rows = []
        for n in ns:
            s = skills[n]
            words = ' '.join([n, en, s['line'], s['note']['about'], ' '.join(s['note']['uses']), ' '.join(s['tags'])])
            rows.append(f'''<li class="row" data-search="{esc(words.lower())}">
        <button class="punch" type="button" data-name="{n}" aria-pressed="false" aria-label="Add {n} to my install command">{icon("plus", "ic ic-plus")}{icon("check", "ic ic-check")}</button>
        <div class="row-main">
          <a class="row-name" href="s/{n}.html">{n}</a>{tag_html(s['tags'])}
          <p>{esc(first_sentence(s['note']['about']))}</p>
        </div>
      </li>''')
        gnote = f'<p class="group-note">{esc(GROUP_NOTES[gid])}</p>' if gid in GROUP_NOTES else ''
        sections.append(f'''<section class="group" id="g-{gid}" aria-labelledby="h-{gid}">
    <h3 class="route" id="h-{gid}"><span>{esc(en)}</span> <span class="km">{km}</span> <span class="route-n">{len(ns)}</span></h3>
    {gnote}<ul class="rows">{''.join(rows)}</ul>
  </section>''')

    desc = f'{count} free skills for Claude Code, Codex, Gemini CLI, Copilot, Cursor and OpenCode, made for Cambodian IT students. Pick the ones you want and install with one command.'
    return f'''{head('SkillJM Skill: free skills for your AI coding tool', desc, SITE + '/', '')}
<body data-page="index">
{ICONS}
<a class="skip" href="#skills">Skip to the skills</a>
<header class="mast">
  {topbar('')}
  <div class="wrap mast-body">
    <h1>Teach your AI coding tool one job at a time.</h1>
    <p class="lead">{count} free skills for Claude Code, Codex, Gemini CLI, Copilot, Cursor and OpenCode, made for Cambodian IT students and developers. A skill is a small folder that shows the AI how to do one job well. You choose which ones you get.</p>
    <p class="lead km">skill ឥតគិតថ្លៃ {count} សម្រាប់ Claude Code, Codex, Gemini CLI, Copilot, Cursor និង OpenCode សម្រាប់និស្សិត IT និង developer ខ្មែរ។ អ្នកជ្រើសរើសខ្លួនឯង។</p>
  </div>
</header>

<main id="main">
  <section class="wrap install" aria-labelledby="install-h">
    <div class="ticket-shadow"><div class="ticket ticket--wide">
      <div class="t-body">
        <h2 id="install-h">Install <span class="km">ដំឡើង</span></h2>
        {os_switch('os-a')}
        <p class="t-how" data-for="win">Open <b>PowerShell</b> and paste this. <span class="km">បើក PowerShell ហើយបិទភ្ជាប់ពាក្យបញ្ជានេះ។</span></p>
        <p class="t-how" data-for="nix" hidden>Open <b>Terminal</b> and paste this. <span class="km">បើក Terminal ហើយបិទភ្ជាប់ពាក្យបញ្ជានេះ។</span></p>
        {cmd_block('cmd-all', js=True)}
      </div>
      <div class="t-stub">
        <p class="stub-big">Nothing installs until you say yes.</p>
        <p>Needs <a href="https://nodejs.org">Node.js</a> 18 or newer.</p>
        <p class="km">គ្មានអ្វីត្រូវបានដំឡើងទេ រហូតដល់អ្នកយល់ព្រម។</p>
        <p class="stub-small">Read it first: <a href="{SITE}/install.ps1">install.ps1</a>, <a href="{SITE}/install.sh">install.sh</a></p>
      </div>
    </div></div>

    <ol class="steps">
      <li><div><b>Tick the skills</b> you want. Each one has a short description. <span class="km">ជ្រើស skill ដែលអ្នកចង់បាន។</span></div></li>
      <li><div><b>Tick your AI tool:</b> Claude Code, Codex, Gemini CLI, Copilot, Cursor, OpenCode, or type another folder. <span class="km">ជ្រើសកម្មវិធី AI ដែលអ្នកប្រើ។</span></div></li>
      <li><div><b>Pick where:</b> this project only, or you, in every project. It shows the folders and asks you to confirm. <span class="km">ជ្រើសថា ដំឡើងក្នុង project នេះ ឬសម្រាប់ខ្លួនអ្នក។</span></div></li>
      <li><div><b>Restart your AI tool</b> and type <code>/</code> to see the skills, for example <code>/debugging</code>. Or just ask: the AI picks the right skill. <span class="km">បិទ ហើយបើកឡើងវិញ រួចវាយ <code>/</code> ដើម្បីមើល skill។</span></div></li>
    </ol>
    <p class="note">Running it again updates your skills. Older copies move to <code>.skilljmskill-backup</code>, never deleted. No tracking, nothing is sent anywhere.</p>
  </section>

  <section class="wrap list" id="skills" aria-labelledby="skills-h">
    <div class="list-head">
      <h2 id="skills-h">All skills <span class="km">skill ទាំងអស់</span></h2>
      <p>Tap <span class="inline-punch">{icon("plus")}</span> to add a skill to your own install command. Tap a name to read what it does.<br>
      <span class="km">ចុច + ដើម្បីបន្ថែម skill ទៅក្នុងពាក្យបញ្ជារបស់អ្នក។ ចុចឈ្មោះ ដើម្បីអានបន្ថែម។</span></p>
    </div>
    <div class="finder">
      <label class="finder-box" for="q">{icon("search")}<span class="sr">Find a skill</span>
        <input id="q" type="search" placeholder="Find a skill: debug, git, 3D, Windows" autocomplete="off" spellcheck="false">
      </label>
      <p class="finder-count" id="count" aria-live="polite">{count} skills</p>
    </div>
    <nav class="routes" aria-label="Skill groups">{nav}</nav>
    {''.join(sections)}
    <div class="empty" id="empty" hidden>
      <p>No skill matches <b id="empty-q"></b>. Try one short word, like <i>git</i> or <i>test</i>.<br>
      <span class="km">រកមិនឃើញ។ សាកពាក្យខ្លីជាងនេះ។</span></p>
      <button type="button" class="btn btn-line" id="clear-q">Clear the search</button>
    </div>
  </section>

  <section class="wrap byhand" aria-labelledby="hand-h">
    <h2 id="hand-h">Or copy one by hand <span class="km">ឬចម្លងដោយដៃ</span></h2>
    <p>Every skill page has a zip to download. Unzip it into the skills folder of your AI tool:</p>
    {folder_table()}
  </section>
</main>

<div class="tray" id="tray" hidden>
  <div class="wrap tray-in">
    <div class="tray-head">
      <p class="tray-n"><b id="tray-n">0 skills</b> in your command <span class="km">ក្នុងពាក្យបញ្ជារបស់អ្នក</span></p>
      <button type="button" class="tray-clear" id="tray-clear">{icon("x")}<span>Clear</span></button>
    </div>
    {cmd_block('cmd-pick', js=True)}
  </div>
</div>
{FOOTER}
<p class="sr" id="live" aria-live="polite"></p>
<script src="assets/site.js"></script>
</body>
</html>
'''


# ---------- one page per skill ----------

def build_skill_page(s, group, prev, nxt, zip_size):
    n, note = s['name'], s['note']
    gid, gen, gkm, _ = group
    win = f'& ([scriptblock]::Create((irm {SITE}/install.ps1))) --skills {n}'
    nix = f'curl -fsSL {SITE}/install.sh | sh -s -- --skills {n}'
    uses = ''.join(f'<li>{esc(u)}</li>' for u in note['uses'])
    needs = (''.join(f'<li>{esc(x)}</li>' for x in note['needs']) if note['needs']
             else '<li>Nothing extra. Only your AI tool.</li>')
    inside = ''.join(f'<li>{esc(h)}</li>' for h in s['inside'])
    extras = ''
    if s['extras']:
        extras = '<p class="note">The folder also has ' + ', '.join(
            f'<code>{esc(e)}{"/" if "." not in e else ""}</code>' for e in s['extras']) + \
            ', so copy the whole folder, not only <code>SKILL.md</code>.</p>'
    km = f'<p class="km title-km">{esc(note["km"])}</p>' if note.get('km') else ''
    pager = '<nav class="pager wrap" aria-label="More skills">'
    if prev:
        pager += f'<a class="pg pg-prev" href="{prev}.html">{icon("left")}<span><small>Previous</small>{prev}</span></a>'
    pager += '<span></span>'
    if nxt:
        pager += f'<a class="pg pg-next" href="{nxt}.html"><span><small>Next</small>{nxt}</span>{icon("right")}</a>'
    pager += '</nav>'
    desc = f'{n}: {s["line"]}'
    lead = first_sentence(note['about'])

    return f'''{head(f'{n}: SkillJM Skill', desc, f'{SITE}/s/{n}.html', '../')}
<body data-page="skill" data-skill="{n}">
{ICONS}
<a class="skip" href="#main">Skip to the content</a>
<header class="mast mast--skill">
  {topbar('../', back=True)}
  <div class="wrap mast-body">
    <a class="route-link" href="../index.html#g-{gid}">{esc(gen)} <span class="km">{gkm}</span></a>
    <h1 class="skill-name">{n}</h1>
    <p class="lead">{esc(lead)}</p>
    {km}
    <div class="mast-tags">{tag_html(s['tags'])}</div>
  </div>
</header>

<main id="main" class="wrap detail">
  <section class="r" aria-labelledby="what-h">
    <h2 id="what-h">What it does <span class="km">វាធ្វើអ្វី</span></h2>
    <p class="about">{esc(note['about'])}</p>
  </section>

  <section class="r" aria-labelledby="when-h">
    <h2 id="when-h">When to use it <span class="km">ពេលណាគួរប្រើ</span></h2>
    <p class="note">Type something like this to your AI tool, or call it by name with <code>/{n}</code>.</p>
    <ul class="prompts">{uses}</ul>
  </section>

  <section class="r" aria-labelledby="needs-h">
    <h2 id="needs-h">What it needs <span class="km">ត្រូវការអ្វីខ្លះ</span></h2>
    <ul class="needs">{needs}</ul>
  </section>

  <aside class="side" aria-labelledby="get-h">
    <div class="ticket">
      <div class="t-body">
        <h2 id="get-h">Install just this skill <span class="km">ដំឡើងតែ skill នេះ</span></h2>
        {os_switch('os-s')}
        <p class="t-how" data-for="win">Paste in <b>PowerShell</b>:</p>
        <div data-for="win">{cmd_block('cmd-win', win)}</div>
        <p class="t-how" data-for="nix" hidden>Paste in <b>Terminal</b>:</p>
        <div data-for="nix" hidden>{cmd_block('cmd-nix', nix)}</div>
        <p class="note">The menu still asks which AI tool and where. Needs Node.js 18 or newer.</p>
        <button type="button" class="btn btn-line add" data-name="{n}" aria-pressed="false">{icon("plus", "ic ic-plus")}{icon("check", "ic ic-check")}<span class="add-off">Add to my list of skills</span><span class="add-on">In my list</span></button>
      </div>
      <div class="t-stub">
        <p class="stub-big">No Node.js? Download it.</p>
        <a class="btn btn-solid" href="../downloads/{n}.zip" download>{icon("down")}<span>Download {n}.zip <small>{kb(zip_size)}</small></span></a>
        <a class="btn btn-line" href="{REPO}/tree/main/skills/{n}">{icon("folder")}<span>See the folder on GitHub</span></a>
      </div>
    </div>
  </aside>

  <section class="r" aria-labelledby="where-h">
    <h2 id="where-h">Where to unzip it <span class="km">ពន្លាចូល folder ណា</span></h2>
    {folder_table(n)}
  </section>

  <section class="r" aria-labelledby="inside-h">
    <h2 id="inside-h">What is inside <span class="km">មានអ្វីខ្លះនៅខាងក្នុង</span></h2>
    <p class="note">The parts of its <a href="{REPO}/blob/main/skills/{n}/SKILL.md">SKILL.md</a>, the file your AI tool reads:</p>
    <ul class="inside">{inside}</ul>
    {extras}
  </section>
</main>
{pager}
{FOOTER}
<p class="sr" id="live" aria-live="polite"></p>
<script src="../assets/site.js"></script>
</body>
</html>
'''


def main():
    names = sorted(n for n in os.listdir(os.path.join(ROOT, 'skills'))
                   if os.path.isfile(os.path.join(ROOT, 'skills', n, 'SKILL.md')))
    grouped = {n for _, _, _, ns in GROUPS for n in ns}
    missing = [n for n in names if n not in grouped]
    groups = [(g, en, km, [n for n in ns if n in names]) for g, en, km, ns in GROUPS]
    if missing:
        groups.append(('more', 'More', 'ផ្សេងៗ', missing))

    skills = {n: load_skill(n) for n in names}
    order = [n for _, _, _, ns in groups for n in ns]

    # Remove pages and zips of skills that no longer exist.
    for folder, ext in (('s', '.html'), ('downloads', '.zip')):
        d = os.path.join(ROOT, folder)
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f.endswith(ext) and f[:-len(ext)] not in skills:
                    os.remove(os.path.join(d, f))

    os.makedirs(os.path.join(ROOT, 's'), exist_ok=True)
    total = 0
    for group in groups:
        for n in group[3]:
            i = order.index(n)
            size = write_zip(skills[n])
            total += size
            page = build_skill_page(skills[n], group, order[i - 1] if i else None,
                                    order[i + 1] if i + 1 < len(order) else None, size)
            io.open(os.path.join(ROOT, 's', n + '.html'), 'w', encoding='utf-8', newline='\n').write(page)

    page = build_index(groups, skills, len(names))
    io.open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)
    print(f'index.html + {len(names)} skill pages, {len(names)} zips ({kb(total)} in all)')


if __name__ == '__main__':
    main()
