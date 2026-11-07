// Lists every clickable box or step that has no plain explanation in both languages, and every
// diagram without a What / How / Why row. Fill gaps in map-data.mjs (info), details.mjs, or
// map-explain.mjs under the key "<diagram>.<item id>".
//   node find-empty.mjs
import { LANGS, loadAll, resolveInfo, clickables, pick } from './lib.mjs';

const { maps, details, explain, www } = await loadAll();
const gaps = [];
for (const [name, map] of Object.entries(maps)) {
  for (const item of clickables(map)) {
    const { info } = resolveInfo(item, name, details, explain);
    const missing = LANGS.filter((l) => !pick(info, l).trim());
    if (missing.length) gaps.push(`${name}.${item.id}  (${pick(item.label, 'en') || pick(item.label, 'ko')})  missing: ${missing.join(', ')}`);
    if (typeof item.info === 'string' && !resolveInfo({ info: item.info }, name, details, {}).info) {
      gaps.push(`${name}.${item.id}  info key "${item.info}" is not in details.mjs`);
    }
    for (const l of LANGS) {
      if (!pick(item.label, l).trim()) gaps.push(`${name}.${item.id}  label missing: ${l}`);
    }
  }
  const w = www[name];
  for (const part of ['what', 'how', 'why']) {
    for (const l of LANGS) if (!w || !pick(w[part], l).trim()) gaps.push(`www-data ${name}.${part}  missing: ${l}`);
  }
}
for (const g of gaps) console.log('  ' + g);
if (gaps.length) { console.log(`${gaps.length} items need an explanation`); process.exitCode = 1; }
else console.log('every item has an explanation');
