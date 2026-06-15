-- App-wide AI settings (singleton row, admin-managed)
create table public.app_settings (
  id boolean primary key default true,
  preferred_provider text not null default 'anthropic' check (preferred_provider in ('anthropic', 'openai', 'gemini')),
  anthropic_api_key text,
  openai_api_key text,
  gemini_api_key text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id)
);

alter table public.app_settings enable row level security;

create policy "Admins can read app settings"
  on public.app_settings for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update app settings"
  on public.app_settings for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert app settings"
  on public.app_settings for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed the singleton row
insert into public.app_settings (id, preferred_provider) values (true, 'anthropic');
