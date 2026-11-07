// Shared explanations, referenced from map-data.mjs as info: 'set.key'.
// Plain words: what the thing is and what it does, not only where it lives.
export default {
  kit: {
    work: {
      ko: '스크립트를 복사해 둔 폴더예요. 원본 파일(map-data.mjs, pages/ 등)도 여기 있고, 결과는 out/ 에 나와요.',
      en: 'The folder the scripts are copied into. The sources (map-data.mjs, pages/ and the rest) live here too, and results go to out/.',
    },
    agent: {
      ko: '문서를 쓰는 AI 예요. 코드를 읽고, 원본 파일을 쓰고, 스크립트를 순서대로 돌려요.',
      en: 'The AI writing the document. It reads the code, writes the source files and runs the scripts in order.',
    },
    repo: {
      ko: '문서가 설명하는 코드예요. 다른 사람이 작업 중일 수 있어서, 고정한 커밋에서 git show 로만 읽어요.',
      en: 'The code the document describes. Others may be working in it, so it is read only at the pinned commit through git show.',
      src: ['scripts/lib.mjs:91-104'],
    },
    sources: {
      ko: '에이전트가 쓰는 파일이에요. 그림 데이터, 설명, What / How / Why, 탭 페이지가 있어요. 문서의 내용은 전부 여기서 나와요.',
      en: 'The files the agent writes: diagram data, explanations, What / How / Why and the tab pages. Everything the document says comes from here.',
    },
    checks: {
      ko: '빌드 전에 도는 검사예요. 인용이 실제 코드 줄을 가리키는지, 모든 상자에 설명이 있는지 봐요.',
      en: 'Checks that run before the build: every citation points at a real line of code, and every box has an explanation.',
    },
    build: {
      ko: '원본을 HTML 로 바꾸는 스크립트예요. 그림 페이지, 카드 줄, 탭이 모인 index.html 을 만들어요.',
      en: 'The scripts that turn the sources into HTML: the diagram pages, the card rows, and index.html with every tab.',
    },
    out: {
      ko: '빌드 결과예요. index.html 과 diagrams/ 폴더가 claude.ai 에 그대로 게시돼요.',
      en: 'The build output. index.html and the diagrams/ folder are published to claude.ai as they are.',
    },
    single: {
      ko: '모든 그림을 넣은 HTML 파일 하나예요. 인터넷이나 서버 없이 디스크에서 바로 열려요.',
      en: 'One HTML file with every diagram inside. It opens straight from disk, with no server and no network.',
    },
    artifact: {
      ko: 'claude.ai 에 게시된 문서예요. 처음에는 본인만 볼 수 있고, 공유는 사용자가 정해요.',
      en: 'The document published on claude.ai. Only its owner can see it at first; sharing is the user\'s choice.',
    },
  },
  seq: {
    cites: { ko: '모든 인용을 고정한 커밋에서 확인해요. 파일이 없거나 줄이 파일 밖이면 문제로 세요.', en: 'Checks every citation at the pinned commit. A missing file or a line past the end counts as a problem.' },
    empty: { ko: '설명이 비어 있는 상자, 단계, 카드를 찾아요. 이 목록이 비어야 빌드해요.', en: 'Finds boxes, steps and cards with no explanation. Build only when the list is empty.' },
    maps: { ko: 'map-data.mjs 의 그림마다 한국어와 영어 HTML 페이지를 그려요. AWS 아이콘과 범례가 들어가요.', en: 'Draws a Korean and an English HTML page for each diagram in map-data.mjs, with AWS icons and a legend.' },
    page: { ko: '그림 아래 카드 줄을 넣고, 탭 페이지를 모아 사이드바가 있는 index.html 을 만들어요.', en: 'Adds the card row under each figure, then gathers the tab pages into index.html with its sidebar.' },
  },
  flow: {
    pin: { ko: '문서가 설명할 커밋을 하나 정해요. push 된 커밋이어야 링크가 열려요.', en: 'Pick the one commit the document describes. It must be pushed or the links will not open.' },
    write: { ko: '코드를 조사해서 path:line 사실을 모으고, 그림 데이터와 탭 페이지를 써요.', en: 'Research the code, collect path:line facts, then write the diagram data and the tab pages.' },
    cites: { ko: 'check-cites 가 문제 0개를 보고하는지 봐요.', en: 'Does check-cites report 0 problems?' },
    fixcite: { ko: '틀린 줄 번호나 없는 파일을 고쳐요. 코드가 바뀌었으면 git grep 으로 다시 찾아요.', en: 'Fix wrong line numbers or missing files. If the code moved, find it again with git grep.' },
    empty: { ko: 'find-empty 가 "every item has an explanation" 을 출력하는지 봐요.', en: 'Does find-empty print "every item has an explanation"?' },
    explain: { ko: '목록에 나온 항목마다 쉬운 말로 설명을 써요. map-explain.mjs 에 "그림.항목" 키로 넣어요.', en: 'Write a plain explanation for each listed item, in map-explain.mjs under the key "diagram.item".' },
    look: { ko: '실제 브라우저에서 그림마다 스크린샷을 찍어요. 두 언어, 다크 모드, 390 px 폰 너비를 봐요.', en: 'Screenshot every diagram in a real browser, in both languages, dark mode and a 390 px phone width.' },
    overlap: { ko: '선 위 글자나 상자 이름이 겹치는지 봐요.', en: 'Do edge labels or box names overlap?' },
    publish: { ko: 'build-page 와 build-single 을 돌리고 out/ 을 게시해요.', en: 'Run build-page and build-single, then publish out/.' },
    report: { ko: '무엇이 바뀌었고 무엇을 확인했는지 알려요. 코드에서 찾은 문제는 findings 파일로 담당자에게 넘겨요.', en: 'Say what changed and what was checked. Problems found in the code go to the owner in a findings file.' },
  },
};
