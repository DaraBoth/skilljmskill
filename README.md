# SkillJM Skill

Free [Claude Code](https://claude.com/claude-code) skills for Cambodian IT students and developers.
Each skill is one folder you copy into Claude Code. No account, no server, no setup beyond copying.

**ភាសាខ្មែរ:** កញ្ចប់ skill ឥតគិតថ្លៃ សម្រាប់ Claude Code សម្រាប់និស្សិត IT និង developer ខ្មែរ។
skill នីមួយៗ គឺជា folder មួយ ដែលអ្នកគ្រាន់តែចម្លងចូល Claude Code ប៉ុណ្ណោះ។

---

## What is a skill? / តើ skill ជាអ្វី?

A skill is a folder with a `SKILL.md` file. It teaches Claude how to do one job well, for example
"explain this fix to me in a web page" or "debug this step by step". Claude reads the skill when
your request matches it, or when you call it by name (`/debugging`).

skill គឺជា folder ដែលមានឯកសារ `SKILL.md`។ វាបង្រៀន Claude ពីរបៀបធ្វើការងារមួយឲ្យបានល្អ។
Claude នឹងប្រើ skill ដោយខ្លួនឯង ពេលសំណើរបស់អ្នកត្រូវនឹងវា ឬពេលអ្នកហៅឈ្មោះវា (`/debugging`)។

---

## Install / របៀបដំឡើង

**One command / ពាក្យបញ្ជាតែមួយ** (website: https://daraboth.github.io/skilljmskill/)

```powershell
# Windows PowerShell: every skill
irm https://daraboth.github.io/skilljmskill/install.ps1 | iex

# Windows PowerShell: only some skills
& ([scriptblock]::Create((irm https://daraboth.github.io/skilljmskill/install.ps1))) debugging devops
```

```bash
# Mac / Linux: every skill
curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh

# Mac / Linux: only some skills
curl -fsSL https://daraboth.github.io/skilljmskill/install.sh | sh -s -- debugging devops
```

It shows every skill with a short description, marks the ones it recommends for the folder you are in,
then asks which skills (Enter = recommended) and where: for you in every project (`~/.claude/skills`)
or only this project (`.claude/skills`, commit it to share with your team).
Skip the questions with `--list`, `--all`, `--recommended`, `--user`, `--project`, `--yes`
(Windows: `-List`, `-All`, `-Recommended`, `-User`, `-Project`, `-Yes`).

វាបង្ហាញ skill ទាំងអស់ ណែនាំ skill ដែលសមនឹង project ហើយសួរថា ដំឡើងសម្រាប់ខ្លួនអ្នក ឬសម្រាប់តែ project នេះ។

Run it again any time to update. Skills you already had are moved to `.skilljmskill-backup`, never deleted.
Then restart Claude Code. Prefer to do it by hand? Follow the steps below.

**By hand / ដោយដៃ**

1. Download this repository (green **Code** button, then **Download ZIP**) and unzip it,
   or run `git clone <this repo url>`.
2. Copy the skill folders you want from `skills/` into your personal skills folder:
   - **Mac / Linux:** `~/.claude/skills/`
   - **Windows:** `%USERPROFILE%\.claude\skills\` (for example `C:\Users\<you>\.claude\skills\`)

   Create the `skills` folder if it does not exist. Copy the whole folder, not only `SKILL.md`,
   because some skills have scripts next to it.
3. Restart Claude Code (close it and open it again).
4. Check: type `/` in Claude Code. The skill names you copied should appear in the list.

```bash
# Mac / Linux: copy one skill
mkdir -p ~/.claude/skills
cp -r skills/debugging ~/.claude/skills/

# Mac / Linux: copy every skill
cp -r skills/* ~/.claude/skills/
```

```powershell
# Windows PowerShell: copy one skill
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse skills\debugging "$env:USERPROFILE\.claude\skills\"

# Windows PowerShell: copy every skill
Copy-Item -Recurse skills\* "$env:USERPROFILE\.claude\skills\"
```

**ខ្មែរ:**
1. ទាញយក repo នេះ (ចុចប៊ូតុង **Code** ពណ៌បៃតង រួច **Download ZIP**) ហើយពន្លាវា។
2. ចម្លង folder skill ដែលអ្នកចង់បាន ពី `skills/` ទៅកាន់៖
   - **Mac / Linux:** `~/.claude/skills/`
   - **Windows:** `%USERPROFILE%\.claude\skills\`

   បើមិនទាន់មាន folder `skills` ទេ សូមបង្កើតវា។ ចម្លង folder ទាំងមូល មិនមែនតែ `SKILL.md` ទេ។
3. បិទ Claude Code ហើយបើកវាឡើងវិញ។
4. វាយ `/` ក្នុង Claude Code ដើម្បីមើលថា skill បានចូលហើយឬនៅ។

Some skills need extra tools: `code-explainer-page` and `project-system-map` need
[Node.js](https://nodejs.org) 18+ and `git`; `disk-cleanup` is Windows only (PowerShell).

skill ខ្លះត្រូវការកម្មវិធីបន្ថែម៖ `code-explainer-page` និង `project-system-map` ត្រូវការ Node.js 18+ និង git។
`disk-cleanup` ប្រើបានតែលើ Windows ប៉ុណ្ណោះ។

---

## Skills / បញ្ជី skill

### Daily dev work and AI / ការងារប្រចាំថ្ងៃ និង AI

| Skill | What it does | ធ្វើអ្វី |
|---|---|---|
| `code-explainer-page` | Explains a code change or fix in one local HTML page: pictures, a code view with green/red lines, notes and checks. | ពន្យល់ការកែកូដ ក្នុងទំព័រ HTML មួយ មានរូបភាព កូដ កំណត់ចំណាំ និងការត្រួតពិនិត្យ។ |
| `auto-handoff` | Hands the current session's work to a fresh Claude session when the conversation gets too big. | ប្រគល់ការងារពី session បច្ចុប្បន្ន ទៅ session ថ្មី ពេលការសន្ទនាវែងពេក។ |
| `html-work-report` | After a task, writes a short plain-English HTML report of what was done and opens it in the browser. | ក្រោយធ្វើការងាររួច បង្កើតរបាយការណ៍ HTML ខ្លី ងាយអាន ហើយបើកវាក្នុង browser។ |
| `project-system-map` | Builds one interactive architecture document for any codebase: diagrams, API, database tab, offline file. | បង្កើតឯកសារស្ថាបត្យកម្មមួយ សម្រាប់ codebase ណាមួយ៖ diagram, API, database និងឯកសារ offline។ |
| `debugging` | A 5-step way to find bugs: reproduce, isolate, identify, fix, verify. No guessing. | វិធី ៥ ជំហានរក bug៖ បង្កើតឡើងវិញ ញែក រកមូលហេតុ កែ និងផ្ទៀងផ្ទាត់។ មិនទាយ។ |
| `devops` | Daily git, commit messages, `.env` files, deployment and CI basics. | មូលដ្ឋាន git, commit message, ឯកសារ `.env`, deploy និង CI ប្រចាំថ្ងៃ។ |
| `cmd` | Command-line cheat sheet for bash/zsh (Mac, Linux) and cmd/PowerShell (Windows). | សន្លឹកជំនួយ command line សម្រាប់ bash/zsh និង cmd/PowerShell។ |
| `java` | Clean Java: classes, OOP, collections, exceptions, good habits. | សរសេរ Java ឲ្យស្អាត៖ class, OOP, collections, exceptions។ |
| `javascript` | Clean modern JavaScript: `const`/`let`, `async`/`await`, destructuring, modules. | សរសេរ JavaScript ទំនើប និងស្អាត។ |
| `system-design` | Plan a small or medium app: MVP scope, UI/Service/Data layers, data flow. | រៀបចំគម្រោងកម្មវិធី៖ MVP, ស្រទាប់ UI/Service/Data និងលំហូរទិន្នន័យ។ |
| `prompt-templates` | Fill-in prompt templates for debugging, code review, refactoring and learning. | គំរូ prompt សម្រាប់ debug, review កូដ, refactor និងការរៀន។ |
| `ai-usage` | How to use AI coding tools well: the CRISP prompt method, and when not to use AI. | របៀបប្រើ AI ជួយសរសេរកូដឲ្យល្អ៖ វិធី CRISP និងពេលណាមិនគួរប្រើ AI។ |
| `team-workflow` | Claude plays a 3-person team (architect, developer, QA) that argues before writing code. | Claude ដើរតួជាក្រុម ៣ នាក់ (architect, developer, QA) ពិភាក្សាមុនសរសេរកូដ។ |
| `skill-creation` | Teaches Claude a new skill from an article or docs you give it. | បង្រៀន Claude នូវ skill ថ្មី ពីអត្ថបទ ឬឯកសារដែលអ្នកផ្ដល់ឲ្យ។ |
| `second-brain` | Turns your notes and articles into a linked Markdown wiki (the "LLM Wiki" idea). | ប្តូរកំណត់ត្រា និងអត្ថបទរបស់អ្នក ទៅជា wiki Markdown ដែលភ្ជាប់គ្នា។ |
| `disk-cleanup` | Frees space on the Windows C: drive by clearing caches. Scans first, deletes only after you say yes. | សម្អាត cache លើ drive C: របស់ Windows។ ស្កេនមុន លុបតែពេលអ្នកយល់ព្រម។ |

### Study and career / ការសិក្សា និងអាជីព

| Skill | What it does | ធ្វើអ្វី |
|---|---|---|
| `learning` | A fast way to learn a new topic: skim, do, explain, then active recall and spaced review. | វិធីរៀនលឿន៖ មើលរំលង ធ្វើ ពន្យល់ រួចរំលឹកឡើងវិញ។ |
| `productivity` | Break a project into milestones and tasks, focus techniques, and simple priorities. | បំបែកគម្រោងជាជំហាន និងការងារតូចៗ បច្ចេកទេសផ្ដោតអារម្មណ៍ និងអាទិភាព។ |
| `career` | Developer career help: interview practice, resume, portfolio. | ជំនួយអាជីព developer៖ ហាត់សម្ភាសន៍ CV និង portfolio។ |

### Design and UI / ការរចនា និង UI

| Skill | What it does | ធ្វើអ្វី |
|---|---|---|
| `ui-design-principles` | Seven UI design principles as a checklist for React + Tailwind + shadcn screens. | គោលការណ៍រចនា UI ៧ ជា checklist សម្រាប់ React + Tailwind + shadcn។ |
| `ui-color-palettes` | Twelve ready colour palettes with full shade scales and readable text pairs. | ក្ដារពណ៌ ១២ ស្រាប់ មានកម្រិតពណ៌ពេញ និងគូពណ៌អក្សរដែលអានបានច្បាស់។ |
| `frontend-design` | Distinctive visual design for new UI, so it does not look like a template. (Anthropic, Apache-2.0) | រចនា UI ឲ្យមានលក្ខណៈពិសេស មិនមើលទៅដូចគំរូទូទៅ។ |
| `3d-web-experience` | 3D websites with Three.js, React Three Fiber and Spline. (vibeship-spawner-skills, Apache-2.0) | គេហទំព័រ 3D ជាមួយ Three.js, React Three Fiber និង Spline។ |

### Three.js (by CloudAI-X, MIT) / Three.js

| Skill | What it does | ធ្វើអ្វី |
|---|---|---|
| `threejs-fundamentals` | Scene, camera, renderer, animation loop, resize, cleanup. | មូលដ្ឋាន៖ scene, camera, renderer និង animation loop។ |
| `threejs-geometry` | Built-in shapes, 3D text, custom meshes, instancing. | រូបរាង 3D, អក្សរ 3D, mesh ផ្ទាល់ខ្លួន និង instancing។ |
| `threejs-materials` | Choosing and tuning materials (basic, PBR, toon). | ជ្រើស និងកែ material (basic, PBR, toon)។ |
| `threejs-lighting` | Lights, shadows, HDR environment lighting. | ពន្លឺ ស្រមោល និងពន្លឺ HDR។ |
| `threejs-textures` | Images on materials, UVs, cubemaps, render targets. | រូបភាពលើ material, UV, cubemap។ |
| `threejs-loaders` | Loading glTF models, textures and HDR files, with progress. | ផ្ទុក model glTF, texture និង HDR។ |
| `threejs-animation` | Keyframes, skeleton animation, morph targets, blending clips. | ចលនា keyframe, ឆ្អឹង និង morph target។ |
| `threejs-interaction` | Clicking 3D objects, camera controls, drag and hover. | ចុចលើវត្ថុ 3D, បញ្ជា camera, drag និង hover។ |
| `threejs-shaders` | Custom GLSL shaders and TSL node materials. | សរសេរ shader GLSL និង TSL ផ្ទាល់ខ្លួន។ |
| `threejs-postprocessing` | Bloom, depth of field, colour grading and other screen effects. | បែបផែនលើអេក្រង់៖ bloom, depth of field, ពណ៌។ |
| `threejs-performance` | Finding and fixing slow 3D scenes. | រក និងដោះស្រាយ scene 3D ដែលយឺត។ |
| `threejs-asset-pipeline` | Shrinking glTF files (Draco, meshopt, KTX2). | បង្រួមឯកសារ glTF ឲ្យតូច។ |
| `threejs-react-three-fiber` | Three.js inside React with React Three Fiber and drei. | ប្រើ Three.js ក្នុង React ជាមួយ React Three Fiber។ |

---

## How to use / របៀបប្រើ

Type the request in plain words. Claude picks the skill, or you can call it with `/name`.
វាយសំណើជាពាក្យធម្មតា។ Claude នឹងជ្រើស skill ឲ្យ ឬអ្នកអាចហៅវាដោយ `/ឈ្មោះ`។

| Skill | Try saying |
|---|---|
| `code-explainer-page` | "Explain the last commit to me in a web page." |
| `auto-handoff` | "My context is too big. Hand off to a fresh session." |
| `html-work-report` | "Install Tailwind in this project, then give me an HTML work report." |
| `project-system-map` | "Make a system map of this repo so a new developer understands everything." |
| `debugging` | "Debug this: `TypeError: Cannot read properties of undefined (reading 'map')`." |
| `devops` | "Help me write a good commit message and set up a `.env` file safely." |
| `cmd` | "How do I find every file that contains 'TODO' on Windows PowerShell?" |
| `java` | "Review my `Student.java` class for clean OOP." |
| `javascript` | "Rewrite this `.then()` chain with `async`/`await`." |
| `system-design` | "Plan the MVP for a library book-borrowing app." |
| `prompt-templates` | "Give me a code review prompt for my pull request." |
| `ai-usage` | "Help me write a better prompt for fixing my login bug." |
| `team-workflow` | "TEAM: build a REST API for a todo list with input validation." |
| `skill-creation` | "Learn this article as a new skill: <paste link or text>." |
| `second-brain` | "Ingest this article into my second brain." / "What does my wiki say about Docker?" |
| `disk-cleanup` | "My C: drive is full. Free up space." |
| `learning` | "Teach me Git branches in the fastest way." |
| `productivity` | "Break my final-year project into tasks for the next 4 weeks." |
| `career` | "Help me prepare for a junior web developer interview." |
| `ui-design-principles` | "Review this dashboard page against the UI design principles." |
| `ui-color-palettes` | "Pick a colour palette for a school management app and put it in Tailwind." |
| `frontend-design` | "Design a landing page for my coffee shop that does not look generic." |
| `3d-web-experience` | "Add a rotating 3D product model to my portfolio homepage." |
| `threejs-*` | "Load my `.glb` model with Three.js and add orbit controls." / "My 3D scene is slow, find out why." |

Tip: `code-explainer-page` and `html-work-report` write files to your temp or home folder, never
inside your project, so they are never committed by mistake.

ជំនួយ៖ `code-explainer-page` និង `html-work-report` រក្សាទុកឯកសារក្នុង folder temp ឬ home
មិនមែនក្នុង project របស់អ្នកទេ ដូច្នេះវាមិនត្រូវបាន commit ដោយច្រឡំឡើយ។

---

## Recommended skills from others / skill ល្អៗពីអ្នកដទៃ

These are great, but they belong to their authors, so they are not copied here. Install them from
the original source. / skill ទាំងនេះល្អណាស់ ប៉ុន្តែជារបស់អ្នកនិពន្ធផ្សេង ដូច្នេះសូមដំឡើងពីប្រភពដើម។

| Skills | Author / source | What they are for |
|---|---|---|
| `grill-me`, `grilling`, `grill-with-docs`, `handoff`, `implement`, `implement-spec`, `codebase-design`, `improve-codebase-architecture`, `domain-modeling`, `diagnosing-bugs`, `git-guardrails-claude-code`, `tdd`, `to-spec`, `to-tickets`, `triage`, `prototype`, `research`, `resolving-merge-conflicts`, `teach`, `wayfinder`, `ask-matt` and more | Matt Pocock, [github.com/mattpocock/skills](https://github.com/mattpocock/skills) | Planning by interview, specs to code, deep modules, bug diagnosis, safe git, TDD |
| `browser-testing-with-devtools` | Addy Osmani, [github.com/addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | Testing web apps in a real browser through Chrome DevTools MCP |
| `design-taste-frontend`, `minimalist-ui`, `industrial-brutalist-ui`, `high-end-visual-design`, `redesign-existing-projects`, `gpt-taste`, `stitch-design-taste`, `image-to-code`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `brandkit`, `full-output-enforcement` | Leonxlnx, [github.com/Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Strong UI taste and design styles |
| `impeccable` | Paul Bakaus, [github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Polished frontend design rules |
| `find-skills` | Vercel Labs, [github.com/vercel-labs/skills](https://github.com/vercel-labs/skills) | Finding and installing more skills |
| `caveman` | [github.com/JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | Short answers that save tokens |
| `orca-cli`, `computer-use`, `orchestration` | Stably AI, [github.com/stablyai/orca](https://github.com/stablyai/orca) | Running several agents in terminal tabs (also used by `auto-handoff`) |
| `agent-reach` | [github.com/Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) | Reading websites and searching the web from an agent |
| `obsidian-markdown`, `obsidian-bases`, `obsidian-cli`, `json-canvas`, `defuddle` | [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) (MIT) | Working with an Obsidian notes vault; pairs well with `second-brain` |
| `eli5`, `drawio`, `d2`, `frontend-slides` | Claude Code plugin marketplaces (install with `/plugin`) | Simple explanations, diagrams, HTML slides |

---

## Contributing / ការចូលរួម

Found a mistake, or want to add a skill in Khmer? Open an issue or a pull request.
រកឃើញកំហុស ឬចង់បន្ថែម skill ជាភាសាខ្មែរ? សូមបើក issue ឬ pull request។

## Licence / អាជ្ញាប័ណ្ណ

MIT for the skills written for this pack (see [LICENSE](LICENSE)). The third-party skills inside
`skills/frontend-design/`, `skills/3d-web-experience/` and `skills/threejs-*/` keep their own
licence file in their folder.

អាជ្ញាប័ណ្ណ MIT សម្រាប់ skill ដែលសរសេរសម្រាប់កញ្ចប់នេះ។ skill របស់អ្នកដទៃ រក្សាអាជ្ញាប័ណ្ណរបស់ខ្លួននៅក្នុង folder របស់វា។
