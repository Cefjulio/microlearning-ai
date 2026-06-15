export type UserRole = 'admin' | 'student';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
}

export type CourseStatus = 'draft' | 'published';

export interface Course {
  id: string;
  title: string;
  topic: string;
  objective: string;
  description: string | null;
  created_by: string;
  created_at: string;
  status: CourseStatus;
  /** BCP-47 language code for AI-generated explanations/summaries/quiz text (e.g. 'en', 'es').
   *  Independent from the subject being taught — an English course can be explained in Spanish. */
  content_language: string;
  modules?: Module[];
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  level_target: string | null;
  order_index: number;
  status: 'draft' | 'ready';
  created_at: string;
  syllabus?: Syllabus | null;
  lessons?: Lesson[];
}

export interface Syllabus {
  id: string;
  module_id: string;
  content: SyllabusContent;
  generated_at: string;
  edited_at: string | null;
}

export interface SyllabusContent {
  overview: string;
  learning_outcomes: string[];
  lessons: SyllabusLesson[];
}

export interface SyllabusLesson {
  order_index: number;
  title: string;
  description: string;
  key_topics: string[];
}

export type QuestionType = 'true_false' | 'multiple_choice' | 'drag_drop' | 'match' | 'fill_blank';

export interface TrueFalseQuestion {
  type: 'true_false';
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
}

export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface DragDropQuestion {
  type: 'drag_drop';
  id: string;
  text: string;
  items: string[];
  correct_order: number[];
  explanation: string;
}

export interface MatchQuestion {
  type: 'match';
  id: string;
  text: string;
  pairs: { left: string; right: string }[];
  explanation: string;
}

export interface FillBlankQuestion {
  type: 'fill_blank';
  id: string;
  text: string; // use ___ as placeholder
  correct_answer: string;
  acceptable_answers: string[];
  explanation: string;
}

export type QuizQuestion =
  | TrueFalseQuestion
  | MultipleChoiceQuestion
  | DragDropQuestion
  | MatchQuestion
  | FillBlankQuestion;

export interface InfographicItem {
  label: string;
  value: string;
  description?: string;
}

export interface Infographic {
  title: string;
  /** 'steps' = numbered process flow, 'stats' = key figures/comparisons, 'comparison' = side-by-side items */
  type: 'steps' | 'stats' | 'comparison';
  items: InfographicItem[];
}

export interface LessonContent {
  summary: string;
  explanation: string;
  examples: { title: string; content: string }[];
  key_points: string[];
  infographic: Infographic;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  order_index: number;
  content: LessonContent | null;
  quiz: QuizQuestion[] | null;
  background_color: string;
  image_url: string | null;
  status: 'draft' | 'published';
  generated_at: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  current_lesson_id: string | null;
}

export interface LessonCompletion {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string;
  quiz_score: number;
}

export interface CourseProgress {
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
}

export interface ModuleProgress {
  module_id: string;
  total: number;
  completed: number;
  percentage: number;
}

export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface AppSettings {
  id: boolean;
  preferred_provider: AIProvider;
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  updated_at: string;
}
