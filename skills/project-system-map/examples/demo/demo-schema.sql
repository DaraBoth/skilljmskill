-- Sample schema for the demo only: a made-up store for system map documents.
-- It exists so gen-schema.mjs has something to read; no real system uses it.
create table documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  rev text not null,
  created_at timestamptz not null default now()
);

create table diagrams (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('free', 'sequence', 'lanes'))
);

create unique index diagrams_document_name on diagrams (document_id, name);

alter table documents add column updated_at timestamptz;
