// Demo: the system map documents this skill's own toolchain. Shapes to copy, not content.
// rev 'WORKTREE' reads files from disk because the skill folder is not a pushed git repo.
// A real project uses the full pushed sha: git log -1 --format=%H origin/<branch>
export default {
  name: 'System Map Kit',
  slug: 'system-map-kit',
  pageTitle: 'System Map Kit', // the <title>; defaults to "<name> System Map"
  repoPath: process.env.SYSTEM_MAP_REPO || '../..', // the folder whose files the cites point into
  repoUrl: '', // e.g. https://github.com/org/repo ; links become <repoUrl>/blob/<rev>/<path>#L<n>
  rev: 'WORKTREE',
  linkBase: '', // only for WORKTREE demos: plain relative links
  created: '2026-10-16',
  updated: '2026-10-16',
  singleFileName: 'system-map-kit-sample.html',
  iconDir: 'dl-aws-icons/package/icons',
  title: { ko: '시스템 지도 도구가 어떻게 만들어져 있고 어떻게 돌아가나', en: 'How the system map kit is built and how it runs' },
  summary: {
    ko: '원본 파일에서 검사와 빌드를 거쳐 문서 한 장이 나오기까지를 한곳에 모았어요. 그림 속 상자를 누르면 설명과 코드 위치가 나와요.',
    en: 'From the source files through the checks and builders to one document, in one place. Click any box in a diagram for its explanation and its place in the code.',
  },
  stats: [{ n: 9, ko: '스크립트', en: 'scripts' }],
  groups: [
    { ko: '개요', en: 'Overview', tabs: [{ id: 'overview', ko: '한눈에 보기', en: 'At a glance' }] },
    { ko: '동작 흐름', en: 'Runtime flows', tabs: [{ id: 'build', ko: '빌드 순서', en: 'Build order' }] },
    { ko: '역할별 흐름', en: 'Roles', tabs: [{ id: 'author', ko: '문서를 쓰는 에이전트', en: 'The writing agent' }] },
    { ko: '데이터', en: 'Data', tabs: [{ id: 'schema', ko: 'DB 스키마 (예시)', en: 'Database schema (sample)' }] },
  ],
};
