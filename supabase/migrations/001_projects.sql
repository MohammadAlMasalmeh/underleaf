-- UnderLeaf: projects table for signed-in users
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)

-- Table: one row per document (tab)
create table if not exists public.projects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'main.tex',
  source text not null default '',
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, id)
);

-- RLS: users can only read/write their own projects
alter table public.projects enable row level security;

create policy "Users can manage own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: index for listing by user
create index if not exists projects_user_id_idx on public.projects (user_id);
