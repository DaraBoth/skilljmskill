# Gotchas

## Commits and citations
- **The documented commit must be pushed.** `check-cites.mjs` counts an unpushed `rev` as a
  problem: every GitHub link would 404. Check `origin` again right before publishing; teammates
  push during the day, and if the branch moved, decide whether to re-pin.
- Read code only with `git show <rev>:<path>` and `git grep -n <pattern> <rev>`. The working tree
  may hold someone else's half-finished edit.
- Line numbers drift when you re-pin. Re-run `check-cites.mjs`, and for each problem find the
  code again with `git grep` rather than shifting numbers by hand.
- A citation range should cover the code that proves the claim, not the whole file.

## Claims
- **Fact-check claims about what code does at runtime.** One "deploy invalidates CloudFront"
  turned out to be a no-op binding. Open the code that actually runs, and the config that turns
  it on.
- A name is not behavior: `retryWithBackoff` may retry once. Read the body.
- Draw what the code proves. Infra the code cannot prove gets "assumed, confirm with infra".

## Writing files from an agent
- **Shell heredocs in this harness eat backslashes**, and the Write tool turned a ` `
  escape into the raw character, which broke a regex. Build escapes with
  `String.fromCharCode(92)` (backslash) and `String.fromCharCode(0x2028)`.
- **`'...'.replace(a, b)` turns `$$` in `b` into `$`** (and `$&` into the match). Use
  `split(a).join(b)`, or pass a function as `b`, for code that contains `$`.
- Escape `<` as `&lt;` inside `<pre><code>` in pages; `check-tags.mjs` will otherwise report a
  tag that is really sample code.

## Building and viewing
- `out/index.html` is a claude.ai artifact fragment: no `<html>`, no charset. Opened from disk it
  shows garbled Korean. Look at it through the single-file build, or serve `out/` over http.
- `file://` is blocked for the Playwright MCP. Serve `out/` (`python -m http.server` inside
  `out/`) or use `page.route()` plus `route.fulfill({ path })`.
- `add-www.mjs` edits `pages/*.html` in place (idempotent). Run it after editing `www-data.mjs`,
  before `build-page.mjs`.
- Lanes diagrams fill the iframe height and scroll sideways; that is intended. Zoom buttons
  change the view inside the diagram, not the page.
- In free diagrams a resource icon (line art) is only clickable on its ring box, which covers the
  icon; keep `size` at 40 or more so it is easy to hit.

## Publishing
- Publish `out/index.html` with `root: "out"`, a `files` map of every `diagrams/*.html`, and
  `capabilities: { downloads: true }` so the Save as Markdown buttons can save. Keep the same
  file path so the URL stays the same; map deleted diagrams to `null`.
- The single offline file is for people without claude.ai access. Give its path every time.
- Never say "visually checked" without a browser screenshot of each diagram.
