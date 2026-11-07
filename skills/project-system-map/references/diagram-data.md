# Diagram data (`map-data.mjs`)

`export default { <name>: { kind, title, subtitle, ... } }`. The key is the diagram's name: a tab
page places it with `<div class="figure" data-map="<name>">`, and the built pages are
`out/diagrams/<name>-map-ko.html` and `-en.html`.

## Text
Every visible text is either a plain string (same in both languages, for code names such as
`check-cites` or `GHCR`) or `{ ko, en }`. Korean in 해요체, easy words, no em dashes, no emoji.

## Explanations and code links (every clickable item)
| field | meaning |
|---|---|
| `info` | `{ ko, en }` inline, or `'set.key'` pointing into `details.mjs` (`export default { set: { key: { ko, en, src? } } }`) |
| `src` | list of citations: `'path/file.ts:12'`, `'path/file.ts:12-30'`, or `{ cite: 'path:line', text: { ko, en } }` |

Gaps can be filled later in `map-explain.mjs`: `export default { '<diagram>.<item id>': { ko, en, src? } }`.
`find-empty.mjs` lists every item still missing an explanation in either language.
Lookup order: the item's own `info`, then `details.mjs`, then `map-explain.mjs` (it fills only
what is still empty). The panel shows the label, `sub`, the explanation ("What it does") and
the code links ("In the code").

## Icons
`icon` is an AWS icon name from the aws-icons package (`config.iconDir`, default
`dl-aws-icons/package/icons`). Matching ignores case and punctuation, and prefers
architecture-service, then resource, then architecture-group, then category. A path such as
`'resource/User'` picks one exactly. For something AWS has no icon for (GitHub, Docker), point
`config.icons = { github: 'my-icons/github.svg' }` at an SVG you made or that has a license you
checked. `build-maps.mjs` prints every missing icon with close matches.

Useful names: `User`, `Users`, `Client`, `Mobileclient`, `Internet`, `Document`, `Documents`,
`Folder`, `Gear`, `GitRepository`, `SourceCode`, `Shield`, `AmazonEC2`, `AmazonCloudFront`,
`AmazonSimpleStorageService`, `ElasticLoadBalancing`, `AmazonRDS`, `AWSLambda`,
`AmazonSimpleQueueService`, `AWSSecretsManager`, `AmazonCloudWatch`.
List them all: `ls dl-aws-icons/package/icons/*`.

## Lines (all kinds)
| field | meaning |
|---|---|
| `from`, `to` | item ids |
| `label`, `label2` | text on the line; `label2` is a second line |
| `style` | omitted: a call. `'secret'`: red, carries a key. `'dashed'`: indirect, queued, optional or planned. `'main'`: the thick main path. `'ref'`: a reference (a foreign key), for schema maps |
| `arrow: false` | no arrowhead (a plain connection) |
| `at` | where on the line the label sits, 0 to 1 (default 0.5) |
| `side` | `above`, `below`, `left`, `right` of the line (default above on horizontal, right on vertical) |
| `anchor` | `start`, `middle`, `end` |
| `offset` | `[dx, dy]` nudge in diagram units |

The legend lists the line kinds that the diagram actually uses.

## `kind: 'free'`: architecture, authored coordinates
```js
{ kind: 'free', title, subtitle, width: 1400, height: 800,
  groups: [{ id?, style, label, note?, x, y, w, h, icon?, info?, src? }],
  nodes:  [{ id, icon, x, y, label, sub?, tag?, size?: 48, labelWidth?: 150, info, src }],
  edges:  [{ from, to, via?: [[x, y], ...], fromPoint?: [x, y], toPoint?: [x, y], ...line fields }],
  legend?: [{ icon, title, line }] | false }
```
- `x, y` of a node is the icon's center. Labels go under the icon (wrapped, up to 3 lines).
- Group styles (AWS colors): `cloud`, `account`, `region` (dashed), `az` (dashed), `vpc`,
  `public`, `private`, `ec2`, `autoscaling` (dashed), `server`, `datacenter`, `generic` (dashed
  grey), `plain`. `icon: false` hides the group icon; `color` overrides the stroke.
- A group becomes clickable when it has an `id` and `info`; only its title area takes the click,
  so boxes inside stay clickable.
- Lines start and end at the edge of the box. `via` adds bend points (use them to draw
  right-angle routes, AWS style); `fromPoint` / `toPoint` pin the exact ends.
- An edge may start or end at a group id.
- Legend: omitted means one row per distinct icon (title = first box's `legendTitle` or label,
  line = `legendLine` or `sub`). Write it by hand when the auto rows read badly.
- Leave 30 to 60 units between boxes and keep labels off lines: fix overlaps with `at`, `side`,
  `offset`, after looking at a screenshot.
- Never invent infrastructure. A subnet, AZ, CIDR or region the code does not prove gets
  "assumed, confirm with infra" in its `note`.

## `kind: 'sequence'`: runtime flows, auto layout
```js
{ kind: 'sequence', title, subtitle, gap?: 200,
  actors: [{ id, icon, label, sub?, info, src }],
  steps: [{ section: { ko, en } } | { id?, from, to, label, style?, info, src }] }
```
- Actors sit 200 units apart in the given order; the header row stays put while the body scrolls.
- Steps are numbered in order (sections are not). A step without `id` is `m1`, `m2`, ... (the key
  for `map-explain.mjs`). `from === to` draws a self loop.
- Long labels start at the left actor instead of centering; the canvas widens to fit them.

## `kind: 'lanes'`: role flows, auto layout
```js
{ kind: 'lanes', title, subtitle, laneHeight?: 132,
  lanes: [{ id, label }],
  nodes: [{ id, lane, type: 'start' | 'step' | 'decision' | 'end', label, sub?, icon?, color?, col?, info, src }],
  edges: [{ from, to, label?, style? }] }
```
- One row per role or system; the lane names stay on the left while the body scrolls sideways.
- Columns come from the longest path from the start over forward edges. Back edges (loops) are
  found automatically and drawn underneath the boxes. Two boxes that land in the same lane and
  column push the later one right. `col` forces a column.
- `start` is a dark pill, `decision` a dark diamond, `step` a white box with a colored bar (the
  icon's color, or `color`), `end` a grey box with a hollow circle.
- Lane edges default to the thick main style; mark failure and retry branches `style: 'dashed'`
  and label decision branches (`yes`, `no`, the status code).
- Draw every branch, then list them again in an "Every branch" table on the tab
  (`references/page-writing.md`).
