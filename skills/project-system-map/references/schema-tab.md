# The Database schema tab

Required. Every table or collection, every field (type, rules, meaning), every index and why it
exists, generated from the schema files at `rev`. Never copied by hand: a hand-written table
drifts the first time someone adds a column.

## Steps
1. Find where the schema lives at `rev` (migrations, Prisma, ORM models, Mongoose schemas).
2. Generate:
   ```bash
   node gen-schema.mjs --sql "supabase/migrations/*.sql"      # Postgres migrations, in file-name order
   node gen-schema.mjs --prisma prisma/schema.prisma
   node gen-schema.mjs --json schema.json                     # anything else, via an adapter
   ```
   The first run prints every missing meaning and writes nothing. Write `schema-notes.mjs`,
   run again until it prints none (or pass `--allow-gaps` for a draft).
3. `pages/schema.html` holds a short lead and `<!-- include: schema.generated.html -->` inside
   `<div class="notes">`.
4. Put the counts in `map-config.mjs` `stats` (for example 36 collections).
5. `config.schemaTables = ['users', ...]` limits the tab to the tables you name.

## `schema-notes.mjs`
```js
export default {
  users: {
    about: { ko: '로그인한 사람 한 명이에요.', en: 'One signed-in person.' },
    defined: 'apps/api/src/users/user.schema.ts:12', // optional: overrides the detected place
    fields: { email: { ko: '…', en: '…' } },
    indexes: { users_email_key: { ko: '같은 이메일로 두 계정을 만들 수 없어요.', en: 'Two accounts cannot share an email.' } },
  },
};
```
A meaning says what the field holds and what reads it, in plain words, not the type again.
An index reason says which query it serves or which duplicate it prevents.

## What the SQL reader understands
`CREATE TABLE` (columns, inline and table-level `PRIMARY KEY` / `UNIQUE`, `NOT NULL`, `DEFAULT`,
`REFERENCES ... ON DELETE`, `CHECK`, `GENERATED`), `ALTER TABLE` (`ADD COLUMN`, `DROP COLUMN`,
`RENAME COLUMN`, `RENAME TO`, `SET` / `DROP NOT NULL`, `ADD CONSTRAINT ... UNIQUE`),
`CREATE [UNIQUE] INDEX ... [USING m] (...) [WHERE ...]`, `DROP INDEX`, `DROP TABLE`. Comments,
quoted strings and `$$` function bodies are skipped. Anything else (views, policies, functions)
is ignored; describe those in prose on the Data tab with `data-cite` links.

## The adapter shape (`--json`)
For Mongoose, TypeORM, Drizzle, Django, Rails and the rest, write a small script that reads the
model files at `rev` and writes `schema.json`:
```json
{ "tables": [
  { "name": "catalogs", "defined": "apps/api/src/catalog/catalog.schema.ts:13",
    "fields": [
      { "name": "name", "type": "String",
        "rules": [{ "ko": "필수", "en": "required" }, { "ko": "최대 80자", "en": "at most 80 characters" }] }
    ],
    "indexes": [
      { "name": "catalog_name_unique_ci", "fields": ["name"],
        "kind": [{ "ko": "유일", "en": "unique" }, { "ko": "대소문자 무시", "en": "ignores case" }] }
    ] }
] }
```
A rule or kind may also be a plain string (shown as code). Include the fields the framework adds
(`_id`, `createdAt`, `updatedAt`) with a rule such as "set by mongoose", because developers see
them in the data.
