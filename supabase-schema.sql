-- Execute este script no SQL Editor do seu projeto Supabase (Supabase > SQL Editor > New query > Run)

create extension if not exists "pgcrypto";

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  unidade text not null,
  nome text not null,
  slug text not null,
  base_url text not null,
  descricao text default '',
  criado_por text not null,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  plataforma text default '',
  source text default '',
  medium text default '',
  term text default '',
  content text default '',
  link text not null,
  short_url text default '',
  criado_por text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_tags_campaign_id on tags(campaign_id);

-- Dados públicos para todos que tiverem a URL/anon key do projeto (sem login), conforme solicitado.
alter table campaigns enable row level security;
alter table tags enable row level security;

create policy "public read campaigns" on campaigns for select using (true);
create policy "public insert campaigns" on campaigns for insert with check (true);
create policy "public update campaigns" on campaigns for update using (true);
create policy "public delete campaigns" on campaigns for delete using (true);

create policy "public read tags" on tags for select using (true);
create policy "public insert tags" on tags for insert with check (true);
create policy "public update tags" on tags for update using (true);
create policy "public delete tags" on tags for delete using (true);
