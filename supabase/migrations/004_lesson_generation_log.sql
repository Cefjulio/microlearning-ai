-- Tracks the most recent AI generation attempt for each lesson, so admins can
-- review the exact prompt used and whether it succeeded, when validating quiz quality.

alter table public.lessons
  add column if not exists last_generation_prompt text,
  add column if not exists last_generation_status text,
  add column if not exists last_generation_error text,
  add column if not exists last_generation_at timestamptz;

comment on column public.lessons.last_generation_prompt is
  'The exact prompt sent to the AI for the most recent generation/rebuild attempt.';
comment on column public.lessons.last_generation_status is
  'Outcome of the most recent generation attempt: success or failed.';
comment on column public.lessons.last_generation_error is
  'Error message if the most recent generation attempt failed.';
comment on column public.lessons.last_generation_at is
  'Timestamp of the most recent generation attempt (success or failure).';
