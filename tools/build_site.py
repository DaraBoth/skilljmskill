# -*- coding: utf-8 -*-
"""Build index.html (the GitHub Pages site) from every skills/<name>/SKILL.md.

    python tools/build_site.py

Run it after adding or changing a skill, then commit index.html.
"""
import html
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://daraboth.github.io/skilljmskill'
REPO = 'https://github.com/DaraBoth/skilljmskill'

GROUPS = [
    ('Coding and debugging', 'សរសេរកូដ និងដោះស្រាយបញ្ហា',
     ['debugging', 'javascript', 'java', 'cmd', 'devops', 'system-design', 'code-explainer-page', 'project-system-map']),
    ('Working with AI', 'ធ្វើការជាមួយ AI',
     ['ai-usage', 'prompt-templates', 'team-workflow', 'skill-creation', 'auto-handoff', 'html-work-report', 'second-brain']),
    ('Design and UI', 'រចនា និង UI',
     ['frontend-design', 'ui-design-principles', 'ui-color-palettes']),
    ('3D on the web', '3D លើវេបសាយ',
     ['3d-web-experience', 'threejs-fundamentals', 'threejs-geometry', 'threejs-materials', 'threejs-textures',
      'threejs-lighting', 'threejs-loaders', 'threejs-animation', 'threejs-interaction', 'threejs-shaders',
      'threejs-postprocessing', 'threejs-performance', 'threejs-asset-pipeline', 'threejs-react-three-fiber']),
    ('Study, career and your computer', 'ការសិក្សា អាជីព និងកុំព្យូទ័រ',
     ['learning', 'productivity', 'career', 'disk-cleanup']),
]


def description(name):
    text = io.open(os.path.join(ROOT, 'skills', name, 'SKILL.md'), encoding='utf-8').read()
    m = re.search(r'^description:\s*(.+)$', text, re.M)
    d = m.group(1).strip().strip('"').strip("'") if m else ''
    d = re.split(r'(?<=[.!?])\s', d)[0]  # first sentence
    d = d.replace(' — ', ': ').replace('—', ', ')
    return d if len(d) <= 170 else d[:167].rstrip() + '...'


def main():
    names = sorted(n for n in os.listdir(os.path.join(ROOT, 'skills'))
                   if os.path.isfile(os.path.join(ROOT, 'skills', n, 'SKILL.md')))
    grouped = {n for _, _, ns in GROUPS for n in ns}
    missing = [n for n in names if n not in grouped]
    groups = GROUPS + ([('More', 'ផ្សេងៗ', missing)] if missing else [])

    sections = []
    for en, km, ns in groups:
        rows = ''.join(
            f'<li><button class="pick" data-name="{n}" aria-pressed="false" title="Add to my install command">'
            f'<code>{n}</code></button><span>{html.escape(description(n))}</span></li>'
            for n in ns if n in names)
        sections.append(f'<section><h3>{en} <span class="km">{km}</span></h3><ul class="skills">{rows}</ul></section>')

    page = TEMPLATE.replace('{{SITE}}', SITE).replace('{{REPO}}', REPO) \
        .replace('{{COUNT}}', str(len(names))).replace('{{SECTIONS}}', '\n'.join(sections))
    io.open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)
    print(f'index.html: {len(names)} skills')


TEMPLATE = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SkillJM Skill</title>
<meta name="description" content="Free Claude Code skills for Cambodian IT students and developers. Install with one command.">
<meta property="og:title" content="SkillJM Skill">
<meta property="og:description" content="{{COUNT}} free Claude Code skills for Cambodian IT students and developers. One command to install.">
<meta property="og:url" content="{{SITE}}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{
  --bg:#F6F7FB; --surface:#FFFFFF; --ink:#141A2E; --muted:#4A5370; --line:#D9DDEA;
  --blue:#1F3FA8; --blue-ink:#FFFFFF; --red:#C8102E; --code-bg:#0F1530; --code-ink:#E8ECFA; --pick:#E6EBFA;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0C1022; --surface:#141A33; --ink:#E9ECF7; --muted:#A9B0CC; --line:#2A3253;
  --blue:#8EA6FF; --blue-ink:#0C1022; --red:#FF6B7F; --code-bg:#070A18; --code-ink:#E8ECFA; --pick:#1E2750;
}}
:root[data-theme="dark"]{
  --bg:#0C1022; --surface:#141A33; --ink:#E9ECF7; --muted:#A9B0CC; --line:#2A3253;
  --blue:#8EA6FF; --blue-ink:#0C1022; --red:#FF6B7F; --code-bg:#070A18; --code-ink:#E8ECFA; --pick:#1E2750;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 'Kantumruy Pro',system-ui,sans-serif}
a{color:var(--blue)}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
header{padding:56px 0 28px;border-bottom:1px solid var(--line)}
.mark{display:inline-flex;gap:4px;margin-bottom:18px}
.mark i{display:block;width:28px;height:6px;border-radius:3px;background:var(--blue)}
.mark i:nth-child(2){background:var(--red)}
h1{margin:0;font-size:clamp(2.1rem,5vw,3.2rem);line-height:1.1;letter-spacing:-.02em;text-wrap:balance}
.lead{max-width:62ch;color:var(--muted);margin:14px 0 0}
.km{font-weight:400;color:var(--muted)}
h2{font-size:1.35rem;margin:44px 0 6px}
h3{font-size:1.05rem;margin:30px 0 8px}
.tabs{display:flex;gap:6px;margin:16px 0 0;flex-wrap:wrap}
.tabs button{font:inherit;font-size:.95rem;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.tabs button[aria-selected="true"]{background:var(--blue);color:var(--blue-ink);border-color:var(--blue)}
.cmd{position:relative;margin:10px 0 0;background:var(--code-bg);color:var(--code-ink);border-radius:10px;padding:16px 92px 16px 18px;overflow-x:auto}
.cmd code{font:14px/1.5 'JetBrains Mono',ui-monospace,monospace;white-space:pre}
.copy{position:absolute;top:10px;right:10px;font:600 13px 'Kantumruy Pro',sans-serif;padding:6px 12px;border-radius:6px;border:0;background:var(--blue);color:var(--blue-ink);cursor:pointer}
.note{color:var(--muted);font-size:.95rem;margin:10px 0 0;max-width:70ch}
.steps{padding-left:22px;max-width:70ch}
.steps li{margin:4px 0}
.skills{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.skills li{display:grid;grid-template-columns:minmax(200px,260px) 1fr;gap:14px;padding:10px 0;border-bottom:1px solid var(--line);align-items:start}
.pick{font:inherit;text-align:left;background:none;border:1px solid transparent;border-radius:6px;padding:2px 6px;margin:-3px 0 0 -7px;cursor:pointer;color:var(--ink)}
.pick code{font:600 14px 'JetBrains Mono',monospace}
.pick:hover{border-color:var(--line)}
.pick[aria-pressed="true"]{background:var(--pick);border-color:var(--blue)}
.pick[aria-pressed="true"] code::before{content:"+ ";color:var(--blue)}
.skills span{color:var(--muted);font-size:.95rem}
#picked{display:none}
#picked.on{display:block}
button:focus-visible{outline:3px solid var(--red);outline-offset:2px}
footer{margin:56px 0 40px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:.92rem}
@media (max-width:640px){.skills li{grid-template-columns:1fr;gap:2px}header{padding-top:36px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="mark" aria-hidden="true"><i></i><i></i><i></i></div>
  <h1>SkillJM Skill</h1>
  <p class="lead">{{COUNT}} free skills for Claude Code, Codex, Gemini CLI, Copilot, Cursor and OpenCode, for made for Cambodian IT students and developers. You choose what to install.<br>
  <span class="km">skill ឥតគិតថ្លៃ {{COUNT}} សម្រាប់ Claude Code សម្រាប់និស្សិត IT និង developer ខ្មែរ។ ដំឡើងដោយពាក្យបញ្ជាតែមួយ។</span></p>
</div></header>

<main class="wrap">
  <h2>Install <span class="km">ដំឡើង</span></h2>
  <div class="tabs" role="tablist" aria-label="Your computer">
    <button role="tab" data-os="win" aria-selected="true">Windows</button>
    <button role="tab" data-os="nix" aria-selected="false">Mac / Linux</button>
  </div>
  <p class="note" data-for="win">Open <b>PowerShell</b> and paste this. <span class="km">បើក PowerShell ហើយបិទភ្ជាប់ពាក្យបញ្ជានេះ។</span></p>
  <p class="note" data-for="nix" hidden>Open <b>Terminal</b> and paste this. <span class="km">បើក Terminal ហើយបិទភ្ជាប់ពាក្យបញ្ជានេះ។</span></p>
  <div class="cmd"><code id="cmd-all"></code><button class="copy" data-copy="cmd-all">Copy</button></div>

  <div id="picked">
    <h3>Only the skills you picked <span class="km">តែ skill ដែលអ្នកបានជ្រើស</span></h3>
    <div class="cmd"><code id="cmd-pick"></code><button class="copy" data-copy="cmd-pick">Copy</button></div>
  </div>
  <p class="note"><b>Nothing is installed until you choose.</b> It needs <a href="https://nodejs.org">Node.js</a> 18 or newer. The command opens a menu in your terminal: (1) tick the skills you want from the list, each with a short description; (2) tick the AI tool you use: Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, OpenCode, or type another tool's folder; (3) pick <b>this project</b> or <b>me, every project</b>. It shows exactly which folders it will write to and asks you to confirm.<br>
  <span class="km">គ្មានអ្វីត្រូវបានដំឡើងទេ រហូតដល់អ្នកជ្រើសរើស៖ ជ្រើស skill ជ្រើសកម្មវិធី AI ដែលអ្នកប្រើ ហើយជ្រើសថា ដំឡើងក្នុង project នេះ ឬសម្រាប់ខ្លួនអ្នក។</span></p>
  <p class="note">Already know what you want? Click skill names below to pre-tick them in the command. Running it again updates the skills; your older copies are moved to <code>.skilljmskill-backup</code>, never deleted.<br>
  <span class="km">ចង់បានតែខ្លះ? ចុចឈ្មោះ skill ខាងក្រោម ដើម្បីបង្កើតពាក្យបញ្ជារបស់អ្នក។</span></p>

  <h2>Then <span class="km">បន្ទាប់មក</span></h2>
  <ol class="steps">
    <li>Close Claude Code and open it again. <span class="km">បិទ Claude Code ហើយបើកវាឡើងវិញ។</span></li>
    <li>Type <code>/</code> and you will see the skills, for example <code>/debugging</code>. <span class="km">វាយ <code>/</code> ដើម្បីមើល skill ។</span></li>
    <li>Or just ask: Claude picks the right skill when your request matches it. <span class="km">ឬគ្រាន់តែសួរ Claude នឹងជ្រើស skill ដោយខ្លួនឯង។</span></li>
  </ol>
  <p class="note">Prefer to read before you run? The installers are short: <a href="{{SITE}}/install.ps1">install.ps1</a> and <a href="{{SITE}}/install.sh">install.sh</a>. Or copy folders by hand from <a href="{{REPO}}">the repository</a>.</p>

  <h2>All skills <span class="km">skill ទាំងអស់</span></h2>
  {{SECTIONS}}
</main>

<footer><div class="wrap">
  Free and open source. Our own skills are MIT; skills from other authors keep their own licence inside their folder. <a href="{{REPO}}">Source on GitHub</a>.
</div></footer>

<script>
(function(){
  var SITE='{{SITE}}';
  var os=/Windows/.test(navigator.userAgent)||!/Mac|Linux|Android|iPhone|iPad/.test(navigator.userAgent)?'win':'nix', picked=[];
  function cmd(names){
    if(os==='win'){
      return names.length ? '& ([scriptblock]::Create((irm '+SITE+'/install.ps1))) --skills '+names.join(',')
                          : 'irm '+SITE+'/install.ps1 | iex';
    }
    return 'curl -fsSL '+SITE+'/install.sh | sh'+(names.length ? ' -s -- --skills '+names.join(',') : '');
  }
  function render(){
    document.getElementById('cmd-all').textContent=cmd([]);
    document.getElementById('cmd-pick').textContent=cmd(picked);
    document.getElementById('picked').classList.toggle('on', picked.length>0);
    document.querySelectorAll('[data-for]').forEach(function(p){p.hidden=p.getAttribute('data-for')!==os;});
  }
  document.querySelectorAll('[role=tab]').forEach(function(b){
    b.setAttribute('aria-selected', b.dataset.os===os);
    b.addEventListener('click',function(){
      os=b.dataset.os;
      document.querySelectorAll('[role=tab]').forEach(function(x){x.setAttribute('aria-selected', x===b);});
      render();
    });
  });
  document.querySelectorAll('.pick').forEach(function(b){
    b.addEventListener('click',function(){
      var n=b.dataset.name, i=picked.indexOf(n);
      if(i<0) picked.push(n); else picked.splice(i,1);
      b.setAttribute('aria-pressed', i<0);
      render();
    });
  });
  document.querySelectorAll('.copy').forEach(function(b){
    b.addEventListener('click',function(){
      var t=document.getElementById(b.dataset.copy).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){
        b.textContent='Copied'; setTimeout(function(){b.textContent='Copy';},1600);
      },function(){ b.textContent='Select and copy'; });
    });
  });
  render();
})();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
