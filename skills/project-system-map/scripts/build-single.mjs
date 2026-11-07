// Builds one offline HTML file: out/index.html wrapped in a real document (charset, viewport),
// with every out/diagrams/*.html embedded as window.MAP_DIAGRAMS. Iframes then load through
// srcdoc and "Open full screen" through blob URLs, so the file works from disk with no server.
//   node build-single.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, load, scriptJson, listFiles } from './lib.mjs';

const config = await load('map-config.mjs');
const index = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const diagrams = {};
for (const f of listFiles(path.join(OUT, 'diagrams'), '.html')) diagrams[path.basename(f, '.html')] = fs.readFileSync(f, 'utf8');
if (!index.includes('<!--MAP_DIAGRAMS-->')) { console.error('out/index.html has no <!--MAP_DIAGRAMS--> marker; rebuild it with build-page.mjs'); process.exit(1); }
const body = index.replace('<!--MAP_DIAGRAMS-->', () => `<script>window.MAP_DIAGRAMS = ${scriptJson(diagrams)};</script>`);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${body}
</body>
</html>
`;
const name = config.singleFileName || `${config.slug || 'project'}-system-map.html`;
fs.writeFileSync(path.join(OUT, name), html);
console.log(`wrote out/${name} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${Object.keys(diagrams).length} diagram pages embedded)`);
