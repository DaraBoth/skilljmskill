# -*- coding: utf-8 -*-
"""Plain-English notes for each skill page, written from its SKILL.md.

build_site.py reads NOTES. Each entry:
  about  2 to 4 short sentences: what the skill does, in plain words.
  km     one short Khmer line.
  uses   3 to 5 things a student could type to use it.
  needs  what it needs beyond the AI tool, only when the SKILL.md says so ([] when nothing).
  tags   very short labels shown in the skill list (optional).

A skill with no entry here still gets a page: build_site.py falls back to its description.
Rules for this file: short words, no em dashes, no emoji.
"""

NODE = 'Node.js 18 or newer (nodejs.org)'
GIT = 'git'
ORBIT = 'A free Orbit board connected to your AI tool. The orbit-task skill shows how to set it up.'
THREE = 'A web project that uses three.js (installed with npm, so you need Node.js)'

NOTES = {
    '3d-web-experience': dict(
        about='Helps you plan and build 3D on a website: a product you can turn, a 3D portfolio, or a page '
              'that moves in 3D as you scroll. It helps you choose between Three.js, React Three Fiber and '
              'Spline, prepare 3D models so they load fast, and avoid the common mistakes that make 3D pages slow.',
        km='គេហទំព័រ 3D ជាមួយ Three.js, React Three Fiber និង Spline។',
        uses=['Add a rotating 3D product model to my portfolio homepage.',
              'Should I use Three.js, React Three Fiber or Spline for this landing page?',
              'Make the 3D scene move when the user scrolls.',
              'My 3D model is 40 MB. How do I make it load faster?'],
        needs=['A web project. Three.js or React Three Fiber is installed with npm, so you need Node.js.'],
    ),
    'ai-usage': dict(
        about='Teaches good habits for working with AI coding tools. The main idea is the CRISP way to write '
              'a prompt: Context, Role, Instruction, Specifics and Proof. It also shows how to debug with AI, '
              'when not to use AI, and how to keep learning instead of copying answers.',
        km='របៀបប្រើ AI ជួយសរសេរកូដឲ្យល្អ៖ វិធី CRISP និងពេលណាមិនគួរប្រើ AI។',
        uses=['Help me write a better prompt for fixing my login bug.',
              'Is it a good idea to use AI for my final-year project report?',
              'Rewrite my prompt with the CRISP method.',
              'How do I use AI without becoming lazy at coding?'],
        needs=[],
    ),
    'auto-handoff': dict(
        about='When a chat with the AI gets too long, this skill hands the work to a fresh session. It writes '
              'a handoff file with everything the new session must know, opens the new session in a new '
              'terminal tab with the same settings, checks that it took over, then stops.',
        km='ប្រគល់ការងារពី session បច្ចុប្បន្ន ទៅ session ថ្មី ពេលការសន្ទនាវែងពេក។',
        uses=['My context is too big. Hand off to a fresh session.',
              'Start a fresh session and pass this work to it.',
              'Hand over this task to a new agent.'],
        needs=['The Orca terminal app (it opens the new session in a new Orca tab).',
               'Claude Code or Codex.'],
        tags=['Orca terminal'],
    ),
    'career': dict(
        about='Helps you grow as a developer: practice for technical interviews, solve coding problems step by '
              'step, improve your resume, choose portfolio projects worth building, and answer behaviour '
              'questions like "tell me about a time you failed".',
        km='ជំនួយអាជីព developer៖ ហាត់សម្ភាសន៍ CV និង portfolio។',
        uses=['Help me prepare for a junior web developer interview.',
              'Review my resume for a first developer job.',
              'Give me a LeetCode problem and coach me through it.',
              'Which three portfolio projects should I build this term?'],
        needs=[],
    ),
    'cmd': dict(
        about='A command line cheat sheet for both worlds: bash and zsh on Mac and Linux, cmd and PowerShell on '
              'Windows. It covers moving between folders, copying and finding files, searching inside files, '
              'stopping programs, and running Java or JavaScript from the terminal.',
        km='សន្លឹកជំនួយ command line សម្រាប់ bash/zsh និង cmd/PowerShell។',
        uses=["How do I find every file that contains 'TODO' on Windows PowerShell?",
              'What is the Mac command for this Windows command?',
              'How do I stop the program that is using port 3000?',
              'Compile and run my Java file from the terminal.'],
        needs=[],
    ),
    'code-explainer-page': dict(
        about='Explains a piece of code or a fix in one web page that opens in your browser. The page has '
              'simple pictures of each step, the code with line numbers and green and red changed lines, '
              'notes you click to light up the code, a check table and a small glossary. Use it to understand '
              'a change before you accept it, then delete the page.',
        km='ពន្យល់ការកែកូដ ក្នុងទំព័រ HTML មួយ មានរូបភាព កូដ កំណត់ចំណាំ និងការត្រួតពិនិត្យ។',
        uses=['Explain the last commit to me in a web page.',
              'Walk me through this fix in the browser.',
              'Show me the code for this pull request before I approve it.',
              'Explain how this function works, with pictures.'],
        needs=[NODE, 'git (for code taken from your history)'],
        tags=['Node.js', 'git'],
    ),
    'computer-control': dict(
        about='Lets the AI use your Windows or Mac computer from the terminal, with no app to install. It can '
              'open apps, websites and Settings pages, change volume and brightness, turn Wi-Fi, Bluetooth '
              'and the camera on or off, read and click buttons by their names, type Khmer or Korean, take '
              'screenshots, and put the computer to sleep and wake it up later. It asks before anything risky.',
        km='ឲ្យ AI បញ្ជាកុំព្យូទ័រ Windows ឬ Mac របស់អ្នក៖ បើកកម្មវិធី សំឡេង កាមេរ៉ា Wi-Fi Bluetooth និងវាយអក្សរខ្មែរ។',
        uses=['Turn the volume down and open Bluetooth settings.',
              'Turn off the camera.',
              'Sleep and wake up in 5 hours.',
              'Type this text into Notepad and save it.',
              'What is using all my memory?'],
        needs=['Windows (uses PowerShell) or macOS (uses bash). On a Mac, allow the terminal under '
               'Accessibility the first time. The Mac part has not been tested on a real Mac yet.'],
        tags=['Windows or Mac'],
    ),
    'customer-loop': dict(
        about='The voice of your users in an AI team on an Orbit board. It collects what people say (feedback '
              'in the app, emails, GitHub issues, reviews), groups the same complaint together, makes task cards '
              'ranked by how many people it hurts, and writes draft replies. It never sends anything: you '
              'read and send the replies yourself.',
        km='ប្រែមតិអ្នកប្រើទៅជាការងារ ហើយព្រាងចម្លើយឲ្យអ្នកផ្ញើ។',
        uses=['What are users saying about my app this week?',
              'Turn this feedback into tasks on the board.',
              'Draft replies to these three GitHub issues.',
              'Run /loop 12h /customer-loop'],
        needs=[ORBIT, 'Works best with pm-loop.'],
        tags=['Orbit board'],
    ),
    'debugging': dict(
        about='A 5 step way to find and fix bugs without guessing: reproduce the bug, isolate where it happens, '
              'identify the real cause, fix it, then verify the fix. It also shows where to put logs and '
              'how to read an error message. It works for JavaScript, Java or any language.',
        km='វិធី ៥ ជំហានរក bug៖ បង្កើតឡើងវិញ ញែក រកមូលហេតុ កែ និងផ្ទៀងផ្ទាត់។ មិនទាយ។',
        uses=["Debug this: TypeError: Cannot read properties of undefined (reading 'map').",
              'My login page used to work and now it does not. Why?',
              'This test fails one time in ten. Help me find out why.',
              'My page takes 8 seconds to load. Find the slow part.'],
        needs=[],
    ),
    'dev-loop': dict(
        about='The builder in an AI team on an Orbit board. It takes the cards given to the dev agent one at a '
              'time, makes the smallest change that works, proves it works, commits on your computer and '
              'sends it to review. It keeps going until the queue is empty. It never pushes or deploys.',
        km='សរសេរកូដម្តងមួយកាត បង្ហាញថាវាដំណើរការ ហើយ commit។',
        uses=['Start the dev agent.',
              'Work the queue on my Orbit board.',
              'Run /loop /dev-loop in this terminal.'],
        needs=[ORBIT, GIT, 'Works with pm-loop, review-loop and qa-loop.'],
        tags=['Orbit board', 'git'],
    ),
    'devops': dict(
        about='The everyday parts of shipping code for one person or a small team: git commands, branches, '
              'good commit messages, fixing merge conflicts, keeping secrets in .env files, simple deployment '
              'and what a CI pipeline does.',
        km='មូលដ្ឋាន git, commit message, ឯកសារ .env, deploy និង CI ប្រចាំថ្ងៃ។',
        uses=['Help me write a good commit message for these changes.',
              'Set up a .env file safely and keep it out of git.',
              'I have a merge conflict. What do I do?',
              'Explain what this GitHub Actions file does.'],
        needs=[],
    ),
    'disk-cleanup': dict(
        about='Frees space on the Windows C: drive by clearing caches that come back by themselves: npm, pip, '
              'temp files, Windows Update leftovers and old driver files. It scans first and shows you a '
              'table. It only deletes after you say yes, and it never touches your projects or documents.',
        km='សម្អាត cache លើ drive C: របស់ Windows។ ស្កេនមុន លុបតែពេលអ្នកយល់ព្រម។',
        uses=['My C: drive is full. Free up space.',
              'How much space can I get back without deleting my files?',
              'The installer says there is not enough space. Help.'],
        needs=['Windows only (it runs a PowerShell script).'],
        tags=['Windows only'],
    ),
    'frontend-design': dict(
        about='Guides the AI to design web pages and apps that look made for their subject, not like a '
              'template. It starts from what the product is, picks fonts and colours on purpose, plans the '
              'first screen, and checks the result against the brief before calling it done.',
        km='រចនា UI ឲ្យមានលក្ខណៈពិសេស មិនមើលទៅដូចគំរូទូទៅ។',
        uses=['Design a landing page for my coffee shop that does not look generic.',
              'My portfolio looks like every other one. Make it feel like mine.',
              'Pick fonts and colours for a school club website.'],
        needs=[],
    ),
    'html-work-report': dict(
        about='After the AI finishes a task, it writes a short report in plain English as a web page and opens '
              'it in your browser: what was done, what changed and what to check. The report is saved in a '
              'work-reports folder in your home folder, never inside your project, so it is never committed '
              'by mistake.',
        km='ក្រោយធ្វើការងាររួច បង្កើតរបាយការណ៍ HTML ខ្លី ងាយអាន ហើយបើកវាក្នុង browser។',
        uses=['Install Tailwind in this project, then give me an HTML work report.',
              'Fix the bug and show me a report of what you did.',
              'Write a work report for today.'],
        needs=[],
    ),
    'java': dict(
        about='Rules for clean, plain Java without big frameworks: classes, the four ideas of OOP, collections, '
              'exceptions, try-with-resources, streams and reading or writing files. It includes a small task '
              'manager example you can build from the command line.',
        km='សរសេរ Java ឲ្យស្អាត៖ class, OOP, collections, exceptions។',
        uses=['Review my Student.java class for clean OOP.',
              'Explain the difference between an interface and an abstract class.',
              'Read a CSV file in Java and handle the errors properly.',
              'Build a small command line to-do app in Java.'],
        needs=[],
    ),
    'javascript': dict(
        about='Rules and patterns for clean modern JavaScript: const and let instead of var, async and await '
              'instead of long .then chains, template strings and destructuring. It also explains the hard '
              'ideas simply: closures, promises, scope, hoisting, the event loop and this.',
        km='សរសេរ JavaScript ទំនើប និងស្អាត។',
        uses=['Rewrite this .then() chain with async/await.',
              'Explain closures with one real example.',
              'Why does this print undefined? Explain hoisting.',
              'Review my JavaScript for bad habits.'],
        needs=[],
    ),
    'learning': dict(
        about='A fast way to learn a new topic that also works for busy or ADHD brains: skim it, do a small '
              'thing with it, then explain it in your own words. After that it uses active recall, spaced '
              'review and small chunks so the knowledge stays.',
        km='វិធីរៀនលឿន៖ មើលរំលង ធ្វើ ពន្យល់ រួចរំលឹកឡើងវិញ។',
        uses=['Teach me Git branches in the fastest way.',
              'I feel lost learning React. Break it into small steps.',
              'Make me a review plan so I do not forget SQL joins.',
              'Quiz me on what I learned yesterday.'],
        needs=[],
    ),
    'orbit-task': dict(
        about='Works one bug or feature card from an Orbit board from start to finish: read the card, make a '
              'branch, fix it, test it, open a pull request and close the card. It stops and asks you, on your '
              'phone, before any step other people will see. It also shows how to set up a free Orbit board '
              'in about 3 minutes.',
        km='ធ្វើការងារពីកាត Orbit ពីដើមដល់ចប់ ដោយសួរអ្នកតាមទូរស័ព្ទនៅរាល់ជំហានសំខាន់។',
        uses=['Set up Orbit for me.',
              'Work the next bug on my Orbit board.',
              'Fix the QA card about the login page.',
              "What's next on the board?"],
        needs=['A free Orbit account, connected to your AI tool (the skill walks you through it).',
               'git, and GitHub if you want pull requests.'],
        tags=['Orbit board', 'git'],
    ),
    'pm-loop': dict(
        about='The planner in an AI team on an Orbit board. It turns your feature idea into small phases of '
              'tasks for the dev agent, checks in every 30 minutes, sends finished work to review and ships '
              'only after you say yes. When only a person can decide, it asks you on your phone. It never '
              'edits code.',
        km='រៀបចំផែនការ feature ជាជំហានតូចៗ ហើយ ship បន្ទាប់ពីអ្នកយល់ព្រម។',
        uses=['Plan this feature for the agents: a dark mode for my app.',
              'Run the PM for my shop website.',
              'Run /loop 30m /pm-loop add a search page'],
        needs=[ORBIT, 'Works with dev-loop, review-loop, qa-loop and customer-loop.'],
        tags=['Orbit board'],
    ),
    'productivity': dict(
        about='Simple systems for getting work done when you feel overwhelmed: break a project into milestones '
              'and small tasks, work in focus blocks, choose what matters first, and beat putting things off '
              'with small steps instead of willpower.',
        km='បំបែកគម្រោងជាជំហាន និងការងារតូចៗ បច្ចេកទេសផ្ដោតអារម្មណ៍ និងអាទិភាព។',
        uses=['Break my final-year project into tasks for the next 4 weeks.',
              'I have too many tasks and I do not know where to start.',
              'Make me a simple daily plan for coding after class.',
              'I keep putting this off. Help me start.'],
        needs=[],
    ),
    'project-system-map': dict(
        about='Builds one interactive document that explains a whole codebase so a new developer understands '
              'it: architecture diagrams in AWS style, a click panel on every box, What, How and Why cards, '
              'the HTTP API, the database tables and the main flows. You get one offline HTML file in Korean '
              'and English, and every claim links to the code.',
        km='បង្កើតឯកសារស្ថាបត្យកម្មមួយ សម្រាប់ codebase ណាមួយ៖ diagram, API, database និងឯកសារ offline។',
        uses=['Make a system map of this repo so a new developer understands everything.',
              'Draw the architecture of this app like an AWS diagram.',
              'Document the database and the API of this project.',
              'Update the system map after this month of changes.'],
        needs=[NODE, 'git, with your commits pushed (the code links point to GitHub)'],
        tags=['Node.js', 'git'],
    ),
    'prompt-templates': dict(
        about='A library of fill-in-the-blank prompts for everyday coding work: debugging, writing code, error '
              'handling, code review, refactoring, testing, speed, documentation, security checks and learning. '
              'You replace the {{PLACEHOLDER}} parts with your own details.',
        km='គំរូ prompt សម្រាប់ debug, review កូដ, refactor និងការរៀន។',
        uses=['Give me a code review prompt for my pull request.',
              'I need a prompt to write tests for this function.',
              'Give me the security check template.'],
        needs=[],
    ),
    'qa-loop': dict(
        about='The tester in an AI team on an Orbit board. It tests approved work on your computer like a real '
              'user would, checks again after shipping, and looks through recent changes for bugs. Each bug '
              'becomes a clear card with steps to reproduce and proof. It never edits code.',
        km='សាកល្បងដូចអ្នកប្រើពិត ហើយរាយការណ៍កំហុស។',
        uses=['Test what the agents built today.',
              'Find bugs in the new checkout page.',
              'Run /loop /qa-loop'],
        needs=[ORBIT, 'Works with pm-loop, dev-loop and review-loop.'],
        tags=['Orbit board'],
    ),
    'review-loop': dict(
        about='The code reviewer in an AI team on an Orbit board. It waits for work marked for review, reads '
              'every commit of the batch against the card and the project rules, and answers PASS or BLOCK. '
              'On BLOCK it writes exact fix cards for the dev agent. It looks for bugs, security holes and '
              'lost data, not style. It never edits code.',
        km='ពិនិត្យកូដរកកំហុស និងបញ្ហាសុវត្ថិភាព។',
        uses=["Review the agent's work.",
              'Check the last batch of commits for security holes.',
              'Run /loop /review-loop'],
        needs=[ORBIT, GIT, 'Works with pm-loop and dev-loop.'],
        tags=['Orbit board', 'git'],
    ),
    'second-brain': dict(
        about='Turns your notes and articles into a linked wiki of Markdown pages, following the "LLM Wiki" '
              'idea: the AI reads each source once and writes it into the wiki, so later questions are answered '
              'from what it already wrote. Your original files stay untouched in a raw folder. It can also '
              'check the wiki for broken links and gaps.',
        km='ប្តូរកំណត់ត្រា និងអត្ថបទរបស់អ្នក ទៅជា wiki Markdown ដែលភ្ជាប់គ្នា។',
        uses=['Ingest this article into my second brain.',
              'What does my wiki say about Docker?',
              'Process my inbox of quick notes.',
              'Check my wiki for broken links.'],
        needs=['A folder for your notes. If you have none, it makes one called second-brain in your home folder.'],
    ),
    'skill-creation': dict(
        about='Teaches the AI a new skill from an article, a tutorial or docs you give it. It reads the '
              'material, pulls out the patterns and rules, and saves them as a new skill folder with a '
              'SKILL.md, so the AI remembers them in later chats.',
        km='បង្រៀន Claude នូវ skill ថ្មី ពីអត្ថបទ ឬឯកសារដែលអ្នកផ្ដល់ឲ្យ។',
        uses=['Learn this article as a new skill: (paste the link or text).',
              'Make a skill from our team coding rules.',
              'Turn these docs into a skill I can reuse.'],
        needs=[],
    ),
    'system-design': dict(
        about='Helps you plan a small or medium app before you code: decide what goes in the first version '
              '(the MVP), split the code into UI, service and data layers, draw how data moves, and write down '
              'each design choice and why.',
        km='រៀបចំគម្រោងកម្មវិធី៖ MVP, ស្រទាប់ UI/Service/Data និងលំហូរទិន្នន័យ។',
        uses=['Plan the MVP for a library book-borrowing app.',
              'How should I structure the folders for this project?',
              'Draw the data flow for user sign up.',
              'My app works but the code is a mess. How do I split it?'],
        needs=[],
    ),
    'talk-to-sessions': dict(
        about='Lets one Claude Code session talk to the other sessions running on your computer: find them, '
              'send them a message, read what they did from their history, and change what a looping agent '
              'does next without restarting it. It can also turn on Remote Control so you can watch from '
              'your phone.',
        km='រក session Claude Code ផ្សេងទៀតដែលកំពុងដំណើរការ ផ្ញើសារទៅពួកវា ហើយមើលពីទូរស័ព្ទ។',
        uses=['Tell the agent in the other terminal that the API key is ready.',
              'Check on the agents. Are any of them stuck?',
              'What are the other sessions doing?',
              'I am not near my computer. Run remote control.'],
        needs=['Claude Code (it uses Claude Code tools to find and message sessions).'],
        tags=['Claude Code only'],
    ),
    'team-workflow': dict(
        about='The AI plays a team of three before it writes the final code: Alice the architect plans the '
              'design, Bob the developer writes the code, and Charlie the tester looks for bugs and security '
              'problems. You see their short discussion first, then the answer.',
        km='Claude ដើរតួជាក្រុម ៣ នាក់ (architect, developer, QA) ពិភាក្សាមុនសរសេរកូដ។',
        uses=['TEAM: build a REST API for a todo list with input validation.',
              'Let the team handle this bug. We do not know the cause.',
              'TEAM: add login to my app across the frontend and backend.'],
        needs=[],
    ),
    'threejs-animation': dict(
        about='How to make things move in three.js: keyframes, skeleton animation for characters, morph '
              'targets for faces, playing the animations inside a glTF model, and blending two animations '
              'smoothly, for example walk into run.',
        km='ចលនា keyframe, ឆ្អឹង និង morph target។',
        uses=['Play the walk animation in my .glb character.',
              'Blend from idle to run smoothly.',
              'Make this cube bounce with code.'],
        needs=[THREE],
    ),
    'threejs-asset-pipeline': dict(
        about='How to shrink 3D model files before you put them on a website, using gltf-transform: check a '
              'file for problems, compress the shapes with Draco or meshopt, compress textures to KTX2, WebP '
              'or AVIF, and set up the loader each format needs.',
        km='បង្រួមឯកសារ glTF ឲ្យតូច។',
        uses=['My .glb file is 60 MB. Make it small enough for the web.',
              'Compress the textures in this model.',
              'Which loader do I need for a Draco file?'],
        needs=[NODE + ' (gltf-transform runs with npx)',
               'KTX-Software 4.4 or newer, only for KTX2 textures'],
        tags=['Node.js'],
    ),
    'threejs-fundamentals': dict(
        about='The base of every three.js project: the scene, the camera, the renderer, the animation loop, '
              'resizing with the window, moving and grouping objects, and cleaning up memory when you are done.',
        km='មូលដ្ឋាន៖ scene, camera, renderer និង animation loop។',
        uses=['Start a three.js scene from scratch with a spinning cube.',
              'My canvas looks stretched when I resize the window.',
              'How do I group objects and move them together?'],
        needs=[THREE],
    ),
    'threejs-geometry': dict(
        about='How to make shapes in three.js: built-in shapes, 3D text, your own meshes from points, lines and '
              'point clouds, and drawing thousands of copies fast with instancing.',
        km='រូបរាង 3D, អក្សរ 3D, mesh ផ្ទាល់ខ្លួន និង instancing។',
        uses=['Add 3D text that says my name.',
              'Draw 10,000 trees without making the page slow.',
              'Make a point cloud from this data.'],
        needs=[THREE],
    ),
    'threejs-interaction': dict(
        about='How to make a 3D scene react to people: click or hover on objects, drag them, move the camera '
              'with orbit controls, and turn mouse or touch positions into 3D positions.',
        km='ចុចលើវត្ថុ 3D, បញ្ជា camera, drag និង hover។',
        uses=['Load my .glb model and add orbit controls.',
              'Highlight an object when the mouse is over it.',
              'Let the user drag the boxes around.'],
        needs=[THREE],
    ),
    'threejs-lighting': dict(
        about='How to light a three.js scene: the light types, shadows and how to fix shadow stripes, HDR '
              'environment light for real looking reflections, and keeping lights fast.',
        km='ពន្លឺ ស្រមោល និងពន្លឺ HDR។',
        uses=['My model looks flat and dark. Light it better.',
              'Fix the stripes on my shadows.',
              'Use an HDR file so the metal reflects the room.'],
        needs=[THREE],
    ),
    'threejs-loaders': dict(
        about='How to load files into three.js: glTF and GLB models (also compressed ones), textures, HDR '
              'environments, showing a loading bar, and cloning or freeing models when you are done.',
        km='ផ្ទុក model glTF, texture និង HDR។',
        uses=['Load my .glb model and show a loading bar.',
              'Load an HDR background for my scene.',
              'Use the same model five times without loading it five times.'],
        needs=[THREE],
    ),
    'threejs-materials': dict(
        about='How to choose and tune materials, the surface of a 3D object: basic, matte, shiny, realistic '
              'PBR, glass and cartoon toon materials, plus transparency and how each reacts to light.',
        km='ជ្រើស និងកែ material (basic, PBR, toon)។',
        uses=['Make this object look like brushed metal.',
              'I want a glass material that looks real.',
              'Give my scene a cartoon look.'],
        needs=[THREE],
    ),
    'threejs-performance': dict(
        about='How to find out why a 3D scene is slow and fix it: measure first, then draw fewer objects '
              'with merging and instancing, use simpler models far away, lower texture memory and keep heavy '
              'work out of the animation loop.',
        km='រក និងដោះស្រាយ scene 3D ដែលយឺត។',
        uses=['My 3D scene is slow. Find out why.',
              'The page crashes on phones. Lower the memory use.',
              'How many draw calls is my scene making?'],
        needs=[THREE],
    ),
    'threejs-postprocessing': dict(
        about='How to add screen effects after the 3D scene is drawn: glow (bloom), blur with depth of field, '
              'soft shadows in corners (ambient occlusion), outlines, colour grading and your own effects.',
        km='បែបផែនលើអេក្រង់៖ bloom, depth of field, ពណ៌។',
        uses=['Make only the neon signs glow.',
              'Add a depth of field blur behind my model.',
              'Draw an outline around the selected object.'],
        needs=[THREE],
    ),
    'threejs-react-three-fiber': dict(
        about='How to use three.js inside React with React Three Fiber and drei: write the scene as JSX, use '
              'hooks for the animation loop and loading, handle clicks on 3D objects, and keep it fast.',
        km='ប្រើ Three.js ក្នុង React ជាមួយ React Three Fiber។',
        uses=['Show my .glb model in a React component.',
              'Rotate the model every frame with useFrame.',
              'Which drei helpers should I use for a product viewer?'],
        needs=['A React project with three.js and React Three Fiber installed with npm (you need Node.js)'],
    ),
    'threejs-shaders': dict(
        about='How to write your own shaders for three.js in GLSL: send values in with uniforms, move points in '
              'the vertex shader, colour pixels in the fragment shader, and change built-in materials. It also '
              'shows the same ideas in TSL for WebGPU.',
        km='សរសេរ shader GLSL និង TSL ផ្ទាល់ខ្លួន។',
        uses=['Write a shader that makes this plane wave like water.',
              'Change the colour of a material with a shader based on height.',
              'Turn this GLSL shader into TSL.'],
        needs=[THREE],
    ),
    'threejs-textures': dict(
        about='How to use images on 3D objects: loading textures, the right colour space, UV maps, repeating '
              'and moving textures, cube maps, render targets and saving texture memory.',
        km='រូបភាពលើ material, UV, cubemap។',
        uses=['My texture looks washed out. Fix the colours.',
              'Repeat this floor tile texture across the ground.',
              'Show a live camera view on a TV screen in my scene.'],
        needs=[THREE],
    ),
    'ui-color-palettes': dict(
        about='Twelve ready colour palettes, each with shades from 50 to 900, plus colours for error, warning '
              'and success. They map straight onto shadcn and Tailwind settings, and the text pairs are '
              'checked so they stay readable.',
        km='ក្ដារពណ៌ ១២ ស្រាប់ មានកម្រិតពណ៌ពេញ និងគូពណ៌អក្សរដែលអានបានច្បាស់។',
        uses=['Pick a colour palette for a school management app and put it in Tailwind.',
              'My app looks AI generated. Give it a real colour system.',
              'Which text colour is readable on this blue?'],
        needs=[],
    ),
    'ui-design-principles': dict(
        about='Seven UI design principles turned into a checklist: hierarchy, showing details only when needed, '
              'consistency, contrast, accessibility, grouping and alignment. It is made for React, Tailwind '
              'and shadcn screens such as dashboards, forms and tables.',
        km='គោលការណ៍រចនា UI ៧ ជា checklist សម្រាប់ React + Tailwind + shadcn។',
        uses=['Review this dashboard page against the UI design principles.',
              'My form is confusing. What should I change?',
              'Check this table screen for accessibility problems.'],
        needs=[],
    ),
}
