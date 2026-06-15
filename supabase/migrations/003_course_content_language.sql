-- Adds a content_language field to courses so admins can choose the language
-- in which AI-generated explanations, summaries, and quiz text are written,
-- independent of the subject being taught (e.g. an "English" course whose
-- vocabulary/grammar stays in English but whose explanations are in Spanish).

alter table public.courses
  add column if not exists content_language text not null default 'en';

comment on column public.courses.content_language is
  'BCP-47 language code for AI-generated explanatory content (lesson explanations, summaries, quiz prompts). The subject matter taught (course topic/vocabulary) is independent of this setting.';
