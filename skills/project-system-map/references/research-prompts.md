# Research prompts

One prompt per topic. Each helper reads only at the pinned commit and returns facts with
`path:line`. Fill in `<repo>`, `<rev>` and the topic. Save every report to a notes file
(`notes/<topic>.md`) the moment it arrives; long sessions compact and chat is lost.

## Shared preamble (put at the top of every prompt)
```
You are researching the codebase at <repo> for an architecture document.
Read ONLY at commit <rev>: use `git -C <repo> show <rev>:<path>` and
`git -C <repo> grep -n <pattern> <rev>`. Do not read the working tree; other agents are
editing it. Never print secret values (keys, tokens, passwords, connection strings); name the
variable instead. Every fact you return carries path:line at <rev>. Say "not found" rather than
guess. Do not suggest fixes; if something looks wrong, list it under FINDINGS with path:line.
```

## Containers and processes
```
List every deployable piece: apps, services, workers, cron jobs, containers. For each: what it
does in one sentence, its entry point (path:line), how it starts (Dockerfile, compose, Procfile,
package script), the port it listens on, what it calls (other services, DBs, queues, external
APIs) and how it is configured (env var names). Return:
FACTS: one line each, path:line
FLOW: a box list (id, icon guess, label) and an edge list (from, to, label) ready for a diagram
FINDINGS
```

## Cloud and network
```
Find what the code and infra files prove about where it runs: IaC (Terraform, CDK, CloudFormation),
compose files, k8s manifests, CI deploy steps, nginx/caddy configs, CloudFront/S3/ALB references,
DNS names. For each resource: what proves it (path:line) and what it connects to. Mark anything
that is only implied as ASSUMED. Do not invent CIDRs, AZs or regions.
FACTS / FLOW / FINDINGS as above
```

## Release and deploy
```
Trace a commit to production: branches, CI workflows (path:line of each job and its trigger),
image or artifact build, registry, how the server gets the new version, migrations, rollbacks,
feature flags. Return a SEQUENCE: numbered steps "actor -> actor: what", each with path:line.
```

## A runtime flow (one prompt per flow: sign-in, the main write path, a background job)
```
Trace <flow> from the first user action to the last side effect. Name each hop: screen or client
call, route (method and path), handler, service, DB writes (table and fields), queue messages,
external calls, responses. Include every error branch (status code and message). Return a
SEQUENCE: numbered "from -> to: label" lines with path:line, plus BRANCHES: "when X: what happens".
```

## Data and statuses
```
List every table or collection: purpose, defining file (path:line), the fields that matter,
every status or enum field with its values and what moves a record from one value to the next
(path:line of each transition). Return FACTS plus a STATUS FLOW per enum (lanes-ready).
```

## HTTP API (feeds a generator, not prose)
```
Find how routes are declared (router files, decorators, file-based routing). Give the pattern a
script can use with git grep to list every route at <rev>: the regex, which capture is the
method and which the path, how auth/role guards appear. Show 3 real examples with path:line.
```

## Roles
```
List every role or permission level. For each: how a user gets it (path:line), what it allows
and what it is refused (status code and message, path:line), which screens hide or show controls
for it. Return one FLOW per role (lanes: the role, the screen, the api, other systems) with every
decision as a branch, and BRANCHES as a table.
```

## Working on the code
```
How a developer runs, tests and changes this repo: setup commands, env files (names only), dev
servers, test commands, lint/typecheck, code generation, conventions in CONTRIBUTING / CLAUDE.md /
.cursor rules, where to add a route, a screen, a migration. Every item with path:line.
```

## Fact-checker (when updating an existing document)
```
Here is the current document's list of claims (paste or point to the notes). For each claim,
check it at <rev> and answer STILL TRUE / CHANGED (what is true now, path:line) / GONE.
Pay most attention to claims about runtime behavior ("X invalidates Y", "Z retries"): open the
code that actually runs, not the name of the function.
```
