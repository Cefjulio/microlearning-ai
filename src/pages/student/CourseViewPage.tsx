import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Course, Module, Lesson } from '../../types';
import ProgressBar from '../../components/shared/ProgressBar';
import Spinner from '../../components/shared/Spinner';
import { ArrowLeft, Lock, CheckCircle, PlayCircle } from 'lucide-react';

export default function CourseViewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({});
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId && user) fetchAll();
  }, [courseId, user]);

  const fetchAll = async () => {
    if (!courseId || !user) return;

    const [courseRes, modulesRes, enrollRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
      supabase.from('enrollments').select('*').eq('user_id', user.id).eq('course_id', courseId).single(),
    ]);

    if (!courseRes.data) { navigate('/'); return; }
    if (!enrollRes.data) { navigate('/'); return; } // must be enrolled

    setCourse(courseRes.data);

    const mods: Module[] = modulesRes.data ?? [];
    setModules(mods);
    if (mods.length > 0) setActiveTab(mods[0].id);

    if (mods.length > 0) {
      const modIds = mods.map(m => m.id);
      const lessonsRes = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', modIds)
        .eq('status', 'published')
        .order('order_index');

      const lesMap: Record<string, Lesson[]> = {};
      (lessonsRes.data ?? []).forEach(l => {
        if (!lesMap[l.module_id]) lesMap[l.module_id] = [];
        lesMap[l.module_id].push(l);
      });
      setLessonsByModule(lesMap);

      const allLessonIds = (lessonsRes.data ?? []).map(l => l.id);
      const compRes = await supabase
        .from('lesson_completions')
        .select('lesson_id')
        .eq('user_id', user.id)
        .in('lesson_id', allLessonIds);

      setCompletions(new Set((compRes.data ?? []).map(c => c.lesson_id)));
    }

    setLoading(false);
  };

  const isUnlocked = (moduleId: string, lessonIdx: number): boolean => {
    const modLessons = lessonsByModule[moduleId] ?? [];
    if (lessonIdx === 0) {
      // First lesson of first module is always unlocked
      const firstModuleId = modules[0]?.id;
      if (moduleId === firstModuleId) return true;
      // First lesson of other modules unlocked if previous module is fully done
      const modIdx = modules.findIndex(m => m.id === moduleId);
      if (modIdx <= 0) return true;
      const prevModId = modules[modIdx - 1].id;
      const prevLessons = lessonsByModule[prevModId] ?? [];
      return prevLessons.every(l => completions.has(l.id));
    }
    const prevLesson = modLessons[lessonIdx - 1];
    return prevLesson ? completions.has(prevLesson.id) : false;
  };

  const getModuleProgress = (moduleId: string) => {
    const lessons = lessonsByModule[moduleId] ?? [];
    if (lessons.length === 0) return 0;
    const done = lessons.filter(l => completions.has(l.id)).length;
    return Math.round((done / lessons.length) * 100);
  };

  const getTotalProgress = () => {
    const allLessons = Object.values(lessonsByModule).flat();
    if (allLessons.length === 0) return 0;
    const done = allLessons.filter(l => completions.has(l.id)).length;
    return Math.round((done / allLessons.length) * 100);
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (!course) return null;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> My Learning
        </button>
        <div>
          <h1>{course.title}</h1>
          <p className="text-muted">🎯 {course.objective}</p>
        </div>
      </div>

      <div className="course-progress-bar">
        <ProgressBar
          percentage={getTotalProgress()}
          label={`Overall Progress: ${getTotalProgress()}%`}
          color="#6C63FF"
          height={12}
        />
      </div>

      {/* Module Tabs */}
      <div className="module-tabs">
        {modules.map(mod => (
          <button
            key={mod.id}
            className={`module-tab ${activeTab === mod.id ? 'active' : ''}`}
            onClick={() => setActiveTab(mod.id)}
          >
            {mod.title}
            <span className="tab-progress">{getModuleProgress(mod.id)}%</span>
          </button>
        ))}
      </div>

      {/* Active Module */}
      {activeTab && (
        <div className="module-panel">
          {(() => {
            const mod = modules.find(m => m.id === activeTab)!;
            const modLessons = lessonsByModule[activeTab] ?? [];
            return (
              <>
                <div className="module-panel-header">
                  <div>
                    <h2>{mod.title}</h2>
                    {mod.level_target && <p className="text-muted">Target: {mod.level_target}</p>}
                  </div>
                </div>
                <ProgressBar
                  percentage={getModuleProgress(activeTab)}
                  label={`${modLessons.filter(l => completions.has(l.id)).length}/${modLessons.length} lessons completed`}
                  color="#00C896"
                />

                <div className="journey-map">
                  {modLessons.map((lesson, idx) => {
                    const done = completions.has(lesson.id);
                    const unlocked = isUnlocked(activeTab, idx);
                    return (
                      <div
                        key={lesson.id}
                        className={`journey-node ${done ? 'done' : unlocked ? 'unlocked' : 'locked'} ${idx % 2 === 0 ? 'left' : 'right'}`}
                        style={{ '--node-color': lesson.background_color } as React.CSSProperties}
                      >
                        <button
                          className="journey-btn"
                          disabled={!unlocked}
                          onClick={() => unlocked && navigate(`/courses/${courseId}/lessons/${lesson.id}`)}
                          style={{ backgroundColor: done ? '#00C896' : unlocked ? lesson.background_color : '#e0e0e0' }}
                        >
                          {done ? <CheckCircle size={20} /> : unlocked ? <PlayCircle size={20} /> : <Lock size={20} />}
                        </button>
                        <span className="journey-label">{lesson.title}</span>
                        {idx < modLessons.length - 1 && <div className="journey-connector" />}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
