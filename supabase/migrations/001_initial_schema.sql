-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'student')),
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  objective text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'published'))
);

alter table public.courses enable row level security;

create policy "Admins can do everything on courses"
  on public.courses for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Students can read published courses"
  on public.courses for select
  using (status = 'published');

-- Modules
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  level_target text,
  order_index integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now()
);

alter table public.modules enable row level security;

create policy "Admins can do everything on modules"
  on public.modules for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Students can read modules of published courses"
  on public.modules for select
  using (
    exists (select 1 from public.courses where id = course_id and status = 'published')
  );

-- Syllabi
create table public.syllabi (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.modules(id) on delete cascade,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  edited_at timestamptz
);

alter table public.syllabi enable row level security;

create policy "Admins can do everything on syllabi"
  on public.syllabi for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Students can read syllabi of published courses"
  on public.syllabi for select
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_id and c.status = 'published'
    )
  );

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  content jsonb,
  quiz jsonb,
  background_color text not null default '#C1E0FF',
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

create policy "Admins can do everything on lessons"
  on public.lessons for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Students can read published lessons"
  on public.lessons for select
  using (status = 'published');

-- Enrollments
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  current_lesson_id uuid references public.lessons(id),
  unique(user_id, course_id)
);

alter table public.enrollments enable row level security;

create policy "Users manage their own enrollments"
  on public.enrollments for all using (auth.uid() = user_id);

-- Lesson Completions
create table public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  quiz_score integer not null default 0,
  quiz_answers jsonb,
  unique(user_id, lesson_id)
);

alter table public.lesson_completions enable row level security;

create policy "Users manage their own completions"
  on public.lesson_completions for all using (auth.uid() = user_id);
