import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';
import type { AppSettings, SyllabusContent, LessonContent, QuizQuestion } from '../types';
import { languageLabel } from './languages';

const JUVENILE_COLORS = [
  '#FFD6E0', '#FFDDC1', '#C1F0DC', '#C1E0FF',
  '#E8D5FF', '#FFFAC1', '#D5F5E3', '#FAD7A0',
  '#AED6F1', '#F9E4B7',
];

export const pickColor = (index: number) => JUVENILE_COLORS[index % JUVENILE_COLORS.length];

export async function getAppSettings(): Promise<AppSettings | null> {
  const { data } = await supabase.from('app_settings').select('*').eq('id', true).single();
  return data ?? null;
}

export async function saveAppSettings(update: Partial<AppSettings>): Promise<AppSettings | null> {
  const { data } = await supabase
    .from('app_settings')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single();
  return data ?? null;
}

// ---- Low-level provider callers: send a prompt, get back raw text ----

async function callAnthropic(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return (message.content[0] as { type: string; text: string }).text;
}

async function callOpenAI(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: 'You are an expert educational content designer. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callLLM(settings: AppSettings, prompt: string, maxTokens: number): Promise<string> {
  switch (settings.preferred_provider) {
    case 'anthropic': {
      if (!settings.anthropic_api_key) throw new Error('No Anthropic API key configured. Add one in Admin Settings.');
      return callAnthropic(settings.anthropic_api_key, prompt, maxTokens);
    }
    case 'openai': {
      if (!settings.openai_api_key) throw new Error('No OpenAI API key configured. Add one in Admin Settings.');
      return callOpenAI(settings.openai_api_key, prompt, maxTokens);
    }
    case 'gemini': {
      if (!settings.gemini_api_key) throw new Error('No Gemini API key configured. Add one in Admin Settings.');
      return callGemini(settings.gemini_api_key, prompt);
    }
    default:
      throw new Error('No AI provider configured.');
  }
}

function extractJSON<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response did not contain valid JSON.');
  let raw = jsonMatch[0];

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Attempt to repair common issues: trailing commas, truncated output
    let repaired = raw.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(repaired) as T;
    } catch (e) {
      // If the response looks truncated (no closing brace at the very end), it likely
      // ran out of tokens — surface a clearer message.
      const looksTruncated = !raw.trim().endsWith('}');
      if (looksTruncated) {
        throw new Error(
          'The AI response was cut off before finishing (likely hit the token limit). Try again — if this keeps happening, try a shorter module description or fewer lessons.'
        );
      }
      throw new Error(`Could not parse AI response as JSON: ${(e as Error).message}`);
    }
  }
}

// ---- High-level generation functions ----

export async function generateSyllabus(
  settings: AppSettings,
  courseTopic: string,
  courseObjective: string,
  moduleTitle: string,
  moduleDescription: string,
  levelTarget: string | null,
  contentLanguage: string = 'en'
): Promise<SyllabusContent> {
  const langName = languageLabel(contentLanguage);
  const languageInstruction = contentLanguage === 'en'
    ? ''
    : `\nIMPORTANT — LANGUAGE: Write all explanatory text (the overview, learning outcomes, lesson descriptions) in ${langName}. ` +
      `However, if the course subject itself is a language or includes language-specific content (e.g. vocabulary, grammar terms, example phrases), ` +
      `KEEP that subject-matter content in its original/target language — only the surrounding explanations, descriptions and outcome statements should be in ${langName}. ` +
      `For example, in an English course explained in Spanish, lesson titles like "Greetings and the Alphabet" may stay in English (since that's what's being taught), ` +
      `but the lesson description explaining what the lesson covers should be written in Spanish.\n`;

  const prompt = `You are an expert curriculum designer. Generate a detailed module syllabus in JSON.
${languageInstruction}
Course topic: "${courseTopic}"
Course objective: "${courseObjective}"
Module title: "${moduleTitle}"
Module description: "${moduleDescription}"
${levelTarget ? `Target level: "${levelTarget}"` : ''}

Return ONLY valid JSON with this exact structure (no markdown fences, no extra text):
{
  "overview": "2-3 sentence overview of what this module covers",
  "learning_outcomes": ["outcome 1", "outcome 2", "outcome 3", "outcome 4", "outcome 5"],
  "lessons": [
    {
      "order_index": 1,
      "title": "Lesson title",
      "description": "1-2 sentence description of what this lesson covers",
      "key_topics": ["topic 1", "topic 2", "topic 3"]
    }
  ]
}

Generate between 6-10 lessons that logically progress from foundational to advanced within this module. Each lesson should be a self-contained micro-learning unit (15-20 minutes).`;

  const text = await callLLM(settings, prompt, 4096);
  return extractJSON<SyllabusContent>(text);
}

export async function generateLesson(
  settings: AppSettings,
  courseTopic: string,
  moduleTitle: string,
  lessonTitle: string,
  lessonDescription: string,
  keyTopics: string[],
  contentLanguage: string = 'en'
): Promise<{ content: LessonContent; quiz: QuizQuestion[]; prompt: string }> {
  const langName = languageLabel(contentLanguage);
  const languageInstruction = contentLanguage === 'en'
    ? ''
    : `\nIMPORTANT — LANGUAGE: Write all explanatory and instructional text in ${langName} — this includes the summary, ` +
      `the explanation prose (besides any quoted target-language terms/phrases), example descriptions, key points, ` +
      `quiz question text, answer options/explanations, and instructions. ` +
      `HOWEVER, if the subject being taught is itself a language (or includes language-specific material like vocabulary, ` +
      `grammar terms, sample sentences, or phrases the learner is meant to acquire), KEEP that subject-matter content in its ` +
      `original/target language so the learner is actually exposed to and practices it — only the surrounding explanations, ` +
      `descriptions and instructions should be written in ${langName}. ` +
      `For example, in an English course explained in Spanish: an example sentence like "She is reading a book" stays in English, ` +
      `but the explanation of why it's correct, and the quiz question asking the learner to identify it, should be written in Spanish.\n`;

  const prompt = `You are an expert educational content creator specializing in microlearning. Generate a complete lesson with content, an infographic, and a 10-question quiz.
${languageInstruction}
Course: "${courseTopic}"
Module: "${moduleTitle}"
Lesson: "${lessonTitle}"
Description: "${lessonDescription}"
Key topics: ${keyTopics.join(', ')}

JSON VALIDITY: The output MUST be valid, parseable JSON. Any double-quote characters that appear inside string values (e.g. quoting a term or phrase) MUST be escaped as \\". Do not use literal smart/curly quotes anywhere. Avoid unescaped newlines inside string values — use \\n instead.

QUIZ DIFFICULTY: All 10 quiz questions must be CHALLENGING — go beyond simple recall. Favor questions that require applying concepts, analyzing scenarios, comparing/contrasting, or spotting subtle distinctions and common misconceptions. Avoid questions answerable from the lesson title alone.

INFOGRAPHIC: Design one infographic that visually summarizes the lesson's most important content (a process flow, key stats/figures, or a comparison). Pick whichever "type" best fits the lesson content.

Return ONLY valid JSON with this exact structure (no markdown fences, no extra text):
{
  "content": {
    "summary": "2-3 sentence engaging summary of the lesson",
    "explanation": "Detailed markdown explanation (300-500 words) covering all key topics with headers, bold terms, and examples inline",
    "examples": [
      { "title": "Example title", "content": "Concrete example with detail" },
      { "title": "Example title 2", "content": "Another example" }
    ],
    "key_points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
    "infographic": {
      "title": "Short title for the infographic",
      "type": "steps",
      "items": [
        { "label": "Step 1 name", "value": "Short headline", "description": "1 sentence detail" },
        { "label": "Step 2 name", "value": "Short headline", "description": "1 sentence detail" },
        { "label": "Step 3 name", "value": "Short headline", "description": "1 sentence detail" },
        { "label": "Step 4 name", "value": "Short headline", "description": "1 sentence detail" }
      ]
    }
  },
  "quiz": [
    {
      "type": "true_false",
      "id": "q1",
      "text": "Statement to evaluate as true or false",
      "correct": true,
      "explanation": "Why this is true/false"
    },
    {
      "type": "multiple_choice",
      "id": "q2",
      "text": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why option A is correct"
    },
    {
      "type": "multiple_choice",
      "id": "q3",
      "text": "Another question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 2,
      "explanation": "Why option C is correct"
    },
    {
      "type": "drag_drop",
      "id": "q4",
      "text": "Arrange these steps in the correct order:",
      "items": ["Step C", "Step A", "Step D", "Step B"],
      "correct_order": [1, 3, 0, 2],
      "explanation": "The correct order is A, B, C, D because..."
    },
    {
      "type": "match",
      "id": "q5",
      "text": "Match each term with its definition:",
      "pairs": [
        { "left": "Term 1", "right": "Definition 1" },
        { "left": "Term 2", "right": "Definition 2" },
        { "left": "Term 3", "right": "Definition 3" }
      ],
      "explanation": "These pairs represent the core relationships in this topic"
    },
    {
      "type": "fill_blank",
      "id": "q6",
      "text": "The process of ___ involves analyzing data to find patterns.",
      "correct_answer": "data mining",
      "acceptable_answers": ["data mining", "mining data", "analysis"],
      "explanation": "Data mining is the process of analyzing large datasets to find patterns"
    },
    {
      "type": "true_false",
      "id": "q7",
      "text": "Another true/false statement related to the lesson",
      "correct": false,
      "explanation": "Why this is false"
    },
    {
      "type": "multiple_choice",
      "id": "q8",
      "text": "A scenario-based question requiring applying a concept from the lesson?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 1,
      "explanation": "Why option B is correct, and why the others are common misconceptions"
    },
    {
      "type": "multiple_choice",
      "id": "q9",
      "text": "A question testing a subtle distinction between two related concepts in the lesson?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 3,
      "explanation": "Why option D is correct"
    },
    {
      "type": "fill_blank",
      "id": "q10",
      "text": "A harder fill-in-the-blank requiring synthesis of multiple ideas: ___",
      "correct_answer": "answer",
      "acceptable_answers": ["answer", "alternate phrasing"],
      "explanation": "Why this is the answer"
    }
  ]
}

Make all questions directly relevant to the lesson content and difficult as instructed above. The drag_drop correct_order array maps each item index to its correct position (0-based). Make content engaging, clear, and appropriate for microlearning.`;

  try {
    const text = await callLLM(settings, prompt, 8192);
    const parsed = extractJSON<{ content: LessonContent; quiz: QuizQuestion[] }>(text);
    return { ...parsed, prompt };
  } catch (e) {
    // AI JSON output is occasionally malformed (e.g. unescaped quotes); retry once.
    const text = await callLLM(settings, prompt, 8192);
    try {
      const parsed = extractJSON<{ content: LessonContent; quiz: QuizQuestion[] }>(text);
      return { ...parsed, prompt };
    } catch {
      throw e;
    }
  }
}
