-- 콘텐츠 메이커 STEP 5
-- Supabase Auth > Anonymous Sign-Ins 를 켜고 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  project_title text not null default '',
  raw_content text not null default '',
  memo text not null default '',
  recommended_title text not null default '',
  template_key text not null default 'modern',
  final_title text not null default '',
  final_body text not null default '',
  status text not null default 'draft',
  analysis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.image_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_no integer not null,
  section_title text not null default '',
  key_message text not null default '',
  source_text text not null default '',
  image_prompt text not null default '',
  image_url text not null default '',
  status text not null default 'pending',
  replaced boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.review_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  check_type text not null,
  result text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.image_tasks enable row level security;
alter table public.review_checks enable row level security;

drop policy if exists "projects own rows" on public.projects;
create policy "projects own rows"
on public.projects for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "image_tasks own rows" on public.image_tasks;
create policy "image_tasks own rows"
on public.image_tasks for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "review_checks own rows" on public.review_checks;
create policy "review_checks own rows"
on public.review_checks for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('content-maker-assets', 'content-maker-assets', true)
on conflict (id) do nothing;

drop policy if exists "assets read public" on storage.objects;
create policy "assets read public"
on storage.objects for select
using (bucket_id = 'content-maker-assets');

drop policy if exists "assets owner insert" on storage.objects;
create policy "assets owner insert"
on storage.objects for insert
with check (
  bucket_id = 'content-maker-assets'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "assets owner update" on storage.objects;
create policy "assets owner update"
on storage.objects for update
using (
  bucket_id = 'content-maker-assets'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "assets owner delete" on storage.objects;
create policy "assets owner delete"
on storage.objects for delete
using (
  bucket_id = 'content-maker-assets'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
