// What / How / Why under each diagram. One short sentence each, both languages.
export default {
  pipeline: {
    what: { ko: '원본 파일 몇 개가 검사와 빌드를 거쳐 문서 한 장이 돼요.', en: 'A few source files become one document after the checks and the build.' },
    how: { ko: '에이전트가 원본을 쓰고, 검사 스크립트가 인용과 설명을 확인하고, 빌드 스크립트가 HTML 을 만들어요.', en: 'The agent writes the sources, the check scripts verify citations and explanations, and the build scripts write the HTML.' },
    why: { ko: '문서의 모든 말이 실제 코드 줄로 돌아갈 수 있어서 믿을 수 있어요.', en: 'Every claim leads back to a real line of code, so the document can be trusted.' },
  },
  build: {
    what: { ko: '스크립트를 도는 순서예요.', en: 'The order the scripts run in.' },
    how: { ko: '검사가 둘 다 통과한 뒤에 그림, 카드, 페이지, 파일 하나 순서로 만들어요.', en: 'After both checks pass, it builds the diagrams, the cards, the page and the single file, in that order.' },
    why: { ko: '틀린 인용이나 빈 설명이 게시되기 전에 멈춰요.', en: 'A wrong citation or an empty explanation stops the run before anything is published.' },
  },
  author: {
    what: { ko: '에이전트가 문서 하나를 끝내는 길이에요.', en: 'The path the agent takes to finish one document.' },
    how: { ko: '갈림길마다 고치고 같은 검사를 다시 돌려요.', en: 'At each branch it fixes the problem and runs the same check again.' },
    why: { ko: '검사가 다 통과해야만 게시하기 때문에 문서가 코드와 어긋나지 않아요.', en: 'Publishing waits for every check, so the document cannot drift from the code.' },
  },
};
