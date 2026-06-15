import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Lesson } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuizView from '../../components/student/QuizView';
import Spinner from '../../components/shared/Spinner';
import { ArrowLeft, BookOpen, Brain } from 'lucide-react';

type Stage = 'lesson' | 'quiz' | 'done';

export default function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/admin/preview');
  const backTarget = isPreview ? `/admin/courses/${courseId}` : `/courses/${courseId}`;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stage, setStage] = useState<Stage>('lesson');
  const [quizScore, setQuizScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (lessonId && user) fetchLesson();
  }, [lessonId, user]);

  const fetchLesson = async () => {
    if (!lessonId || !user) return;

    if (isPreview) {
      // Admin preview: just load the lesson, don't touch completion records
      const { data } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
      setLesson(data ?? null);
      setLoading(false);
      return;
    }

    const [lesRes, compRes] = await Promise.all([
      supabase.from('lessons').select('*').eq('id', lessonId).single(),
      supabase.from('lesson_completions').select('quiz_score').eq('user_id', user.id).eq('lesson_id', lessonId).single(),
    ]);
    setLesson(lesRes.data ?? null);
    if (compRes.data) {
      setAlreadyDone(true);
      setQuizScore(compRes.data.quiz_score);
      setStage('done');
    }
    setLoading(false);
  };

  const handleQuizComplete = async (score: number) => {
    if (!user || !lessonId) return;
    setQuizScore(score);

    if (isPreview) {
      // Don't write completion/enrollment records while previewing as admin
      setStage('done');
      return;
    }

    await supabase.from('lesson_completions').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      quiz_score: score,
      completed_at: new Date().toISOString(),
    });

    // Update enrollment current_lesson (point to next)
    if (courseId) {
      const { data: nextLesson } = await supabase
        .from('lessons')
        .select('id, order_index, module_id')
        .eq('module_id', lesson?.module_id ?? '')
        .eq('status', 'published')
        .gt('order_index', lesson?.order_index ?? 0)
        .order('order_index')
        .limit(1)
        .single();

      await supabase.from('enrollments')
        .update({ current_lesson_id: nextLesson?.id ?? null })
        .eq('user_id', user.id)
        .eq('course_id', courseId);
    }

    setStage('done');
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (!lesson) return <div className="page"><p>Lesson not found.</p></div>;

  const bgColor = lesson.background_color || '#C1E0FF';

  return (
    <div className="lesson-page" style={{ '--lesson-bg': bgColor } as React.CSSProperties}>
      {isPreview && (
        <div className="preview-banner">
          👁 Admin Preview — quiz results won't be saved to student progress
        </div>
      )}
      <div className="lesson-header" style={{ backgroundColor: bgColor }}>
        <button className="btn-ghost" onClick={() => navigate(backTarget)}>
          <ArrowLeft size={16} /> {isPreview ? 'Back to Course Manager' : 'Back to Course'}
        </button>
        <div className="lesson-header-content">
          <h1>{lesson.title}</h1>
          {lesson.content && <p className="lesson-summary">{lesson.content.summary}</p>}
        </div>
        <div className="lesson-stage-tabs">
          <button
            className={`stage-tab ${stage === 'lesson' ? 'active' : ''}`}
            onClick={() => setStage('lesson')}
          >
            <BookOpen size={16} /> Lesson
          </button>
          <button
            className={`stage-tab ${stage === 'quiz' || stage === 'done' ? 'active' : ''}`}
            onClick={() => !alreadyDone && stage === 'lesson' ? setStage('quiz') : setStage('done')}
          >
            <Brain size={16} /> Quiz
          </button>
        </div>
      </div>

      {stage === 'lesson' && lesson.content && (
        <div className="lesson-body">
          {lesson.image_url && (
            <img src={lesson.image_url} alt={lesson.title} className="lesson-hero-image" />
          )}

          <div className="lesson-content-card">
            <section className="lesson-section">
              <h2>Explanation</h2>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lesson.content.explanation}
              </ReactMarkdown>
            </section>

            {lesson.content.examples.length > 0 && (
              <section className="lesson-section">
                <h2>Examples</h2>
                <div className="examples-grid">
                  {lesson.content.examples.map((ex, i) => (
                    <div key={i} className="example-card" style={{ borderLeftColor: bgColor }}>
                      <h4>{ex.title}</h4>
                      <p>{ex.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {lesson.content.infographic && lesson.content.infographic.items?.length > 0 && (
              <section className="lesson-section">
                <h2>{lesson.content.infographic.title}</h2>
                <div className={`infographic infographic-${lesson.content.infographic.type}`}>
                  {lesson.content.infographic.items.map((item, i) => (
                    <div key={i} className="infographic-item" style={{ borderColor: bgColor }}>
                      {lesson.content!.infographic.type === 'steps' && (
                        <div className="infographic-step-num" style={{ background: bgColor }}>{i + 1}</div>
                      )}
                      <div className="infographic-item-body">
                        <h4>{item.label}</h4>
                        <p className="infographic-value">{item.value}</p>
                        {item.description && <p className="infographic-desc">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {lesson.content.key_points.length > 0 && (
              <section className="lesson-section">
                <h2>Key Points</h2>
                <ul className="key-points">
                  {lesson.content.key_points.map((kp, i) => (
                    <li key={i} className="key-point">{kp}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="lesson-cta">
            <button className="btn-primary btn-large" onClick={() => setStage('quiz')}>
              Take the Quiz <Brain size={18} />
            </button>
          </div>
        </div>
      )}

      {stage === 'quiz' && lesson.quiz && !alreadyDone && (
        <QuizView
          questions={lesson.quiz}
          onComplete={handleQuizComplete}
          accentColor={bgColor}
        />
      )}

      {stage === 'done' && (
        <div className="lesson-done">
          <div className="done-card" style={{ backgroundColor: bgColor }}>
            <div className="done-score-circle">
              <span className="done-score">{quizScore}%</span>
              <span className="done-score-label">Score</span>
            </div>
            <h2>Lesson Complete! 🎉</h2>
            <p>{quizScore >= 70 ? 'Great job! You nailed it.' : 'Good effort! Review the lesson and try again anytime.'}</p>
            <div className="done-actions">
              <button className="btn-ghost" onClick={() => setStage('lesson')}>Review Lesson</button>
              <button className="btn-primary" onClick={() => navigate(backTarget)}>
                {isPreview ? 'Back to Course Manager →' : 'Back to Course →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
