// Languages available for course "content language" — i.e. the language in
// which AI-generated explanations, summaries and quiz prompts are written.
// This is independent from the subject being taught (e.g. an "English" course
// can have its vocabulary/grammar stay in English while explanations are in Spanish).

export interface LanguageOption {
  code: string;
  label: string;
}

export const CONTENT_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'ar', label: 'Arabic (العربية)' },
];

export const languageLabel = (code: string): string =>
  CONTENT_LANGUAGES.find(l => l.code === code)?.label ?? code;
