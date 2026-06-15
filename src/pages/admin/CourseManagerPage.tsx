import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Course, Module, Syllabus, Lesson, AppSettings, SyllabusLesson } from '../../types';
import { generateSyllabus, generateLesson, pickColor, getAppSettings } from '../../lib/ai';
import { languageLabel } from '../../lib/languages';
import ProgressBar from '../../components/shared/ProgressBar';
import Spinner from '../../components/shared/Spinner';
import SyllabusEditor from '../../components/admin/SyllabusEditor';
import CourseEditModal from '../../components/admin/CourseEditModal';
import ModuleEditModal from '../../components/admin/ModuleEditModal';
import LessonEditModal from '../../components/admin/LessonEditModal';
import {
  ArrowLeft, Wand2, BookOpen, RefreshCw, CheckCircle, Edit3, Plus, Trash2, Settings2,
  Save, X as XIcon, ChevronUp, ChevronDown, PlayCircle, History, AlertTriangle,
} from 'lucide-react';

export default function CourseManagerPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [syllabi, setSyllabi] = useState<Record<string, Syllabus>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generatingModuleId, setGeneratingModuleId] = useState<string | null>(null);
  const [buildingLessonId, setBuildingLessonId] = useState<string | null>(null);
  const [editingSyllabusId, setEditingSyllabusId] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AppSettings | null>(null);

  // CRUD modal state
  const [editingCourse, setEditingCourse] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null | 'new'>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [viewingGenLog, setViewingGenLog] = useState<Lesson | null>(null);

  // Inline syllabus-topic editing
  const [inlineEditIdx, setInlineEditIdx] = useState<number | null>(null);
  const [topicDraft, setTopicDraft] = useState<SyllabusLesson | null>(null);
  const [newTopicDraft, setNewTopicDraft] = useState('');
  const [savingTopics, setSavingTopics] = useState(false);

  useEffect(() => {
    if (courseId) fetchAll(courseId);
    getAppSettings().then(setAiSettings);
  }, [courseId]);

  const fetchAll = async (cid: string) => {
    const [courseRes, modulesRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', cid).single(),
      supabase.from('modules').select('*').eq('course_id', cid).order('order_index'),
    ]);

    if (!courseRes.data) { navigate('/admin'); return; }
    setCourse(courseRes.data);

    const mods: Module[] = modulesRes.data ?? [];
    setModules(mods);
    if (mods.length > 0 && !activeTab) setActiveTab(mods[0].id);

    if (mods.length > 0) {
      const modIds = mods.map(m => m.id);
      const [sylRes, lesRes] = await Promise.all([
        supabase.from('syllabi').select('*').in('module_id', modIds),
        supabase.from('lessons').select('*').in('module_id', modIds).order('order_index'),
      ]);

      const sylMap: Record<string, Syllabus> = {};
      (sylRes.data ?? []).forEach(s => { sylMap[s.module_id] = s; });
      setSyllabi(sylMap);

      const lesMap: Record<string, Lesson[]> = {};
      (lesRes.data ?? []).forEach(l => {
        if (!lesMap[l.module_id]) lesMap[l.module_id] = [];
        lesMap[l.module_id].push(l);
      });
      setLessons(lesMap);
    }

    setLoading(false);
  };

  // ---------- Course CRUD ----------
  const handleCourseSaved = (updated: Course) => {
    setCourse(updated);
    setEditingCourse(false);
  };

  // ---------- Module CRUD ----------
  const handleModuleSaved = (saved: Module, isNew: boolean) => {
    if (isNew) {
      setModules(prev => [...prev, saved].sort((a, b) => a.order_index - b.order_index));
      setActiveTab(saved.id);
    } else {
      setModules(prev => prev.map(m => m.id === saved.id ? saved : m));
    }
    setEditingModule(null);
  };

  const handleDeleteModule = async (mod: Module) => {
    if (!confirm(`Delete "${mod.title}" and all its syllabus/lessons? This cannot be undone.`)) return;
    await supabase.from('modules').delete().eq('id', mod.id);
    setModules(prev => {
      const remaining = prev.filter(m => m.id !== mod.id);
      if (activeTab === mod.id) setActiveTab(remaining[0]?.id ?? '');
      return remaining;
    });
    setSyllabi(prev => {
      const next = { ...prev };
      delete next[mod.id];
      return next;
    });
    setLessons(prev => {
      const next = { ...prev };
      delete next[mod.id];
      return next;
    });
  };

  // ---------- Syllabus ----------
  const handleGenerateSyllabus = async (mod: Module) => {
    if (!course) return;
    if (!aiSettings) { alert('AI settings not loaded yet. Try again in a moment.'); return; }
    setGeneratingModuleId(mod.id);
    try {
      const content = await generateSyllabus(
        aiSettings,
        course.topic,
        course.objective,
        mod.title,
        mod.description ?? '',
        mod.level_target,
        course.content_language
      );

      const existing = syllabi[mod.id];
      let syl: Syllabus;
      if (existing) {
        const { data } = await supabase
          .from('syllabi')
          .update({ content, generated_at: new Date().toISOString(), edited_at: null })
          .eq('id', existing.id)
          .select()
          .single();
        syl = data!;
      } else {
        const { data } = await supabase
          .from('syllabi')
          .insert({ module_id: mod.id, content })
          .select()
          .single();
        syl = data!;
      }
      setSyllabi(prev => ({ ...prev, [mod.id]: syl }));
    } catch (err) {
      alert('Failed to generate syllabus: ' + (err as Error).message);
    }
    setGeneratingModuleId(null);
  };

  const handleCreateSyllabusManually = async (mod: Module) => {
    if (syllabi[mod.id]) { setEditingSyllabusId(mod.id); return; }
    const emptyContent = { overview: '', learning_outcomes: [], lessons: [] };
    const { data, error } = await supabase
      .from('syllabi')
      .insert({ module_id: mod.id, content: emptyContent, edited_at: new Date().toISOString() })
      .select()
      .single();
    if (error || !data) { alert('Failed to create syllabus: ' + (error?.message ?? 'unknown error')); return; }
    setSyllabi(prev => ({ ...prev, [mod.id]: data }));
    setEditingSyllabusId(mod.id);
  };

  // Persist an updated lessons array for a module's syllabus (used by inline topic editing)
  const persistSyllabusLessons = async (moduleId: string, updatedLessons: SyllabusLesson[]) => {
    const syl = syllabi[moduleId];
    if (!syl) return;
    setSavingTopics(true);
    const updatedContent = { ...syl.content, lessons: updatedLessons };
    const { data, error } = await supabase
      .from('syllabi')
      .update({ content: updatedContent, edited_at: new Date().toISOString() })
      .eq('id', syl.id)
      .select()
      .single();
    setSavingTopics(false);
    if (error || !data) { alert('Failed to save: ' + (error?.message ?? 'unknown error')); return; }
    setSyllabi(prev => ({ ...prev, [moduleId]: data }));
  };

  const startInlineEdit = (idx: number, sylLesson: SyllabusLesson) => {
    setInlineEditIdx(idx);
    setTopicDraft({ ...sylLesson, key_topics: [...sylLesson.key_topics] });
    setNewTopicDraft('');
  };

  const cancelInlineEdit = () => {
    setInlineEditIdx(null);
    setTopicDraft(null);
    setNewTopicDraft('');
  };

  const saveInlineEdit = async (moduleId: string, idx: number) => {
    if (!topicDraft || !activeSyllabusForModule(moduleId)) return;
    const syl = syllabi[moduleId];
    const updatedLessons = syl.content.lessons.map((l, i) => i === idx ? topicDraft : l);
    await persistSyllabusLessons(moduleId, updatedLessons);
    cancelInlineEdit();
  };

  const activeSyllabusForModule = (moduleId: string) => syllabi[moduleId];

  const handleDeleteTopic = async (moduleId: string, idx: number, title: string) => {
    if (!confirm(`Delete lesson topic "${title || '(untitled)'}" from the syllabus?`)) return;
    const syl = syllabi[moduleId];
    if (!syl) return;
    const updatedLessons = syl.content.lessons
      .filter((_, i) => i !== idx)
      .map((l, i) => ({ ...l, order_index: i }));
    await persistSyllabusLessons(moduleId, updatedLessons);
    if (inlineEditIdx === idx) cancelInlineEdit();
  };

  const handleMoveTopic = async (moduleId: string, idx: number, dir: -1 | 1) => {
    const syl = syllabi[moduleId];
    if (!syl) return;
    const j = idx + dir;
    if (j < 0 || j >= syl.content.lessons.length) return;
    const next = [...syl.content.lessons];
    [next[idx], next[j]] = [next[j], next[idx]];
    await persistSyllabusLessons(moduleId, next.map((l, i) => ({ ...l, order_index: i })));
  };

  const handleAddTopicInline = async (moduleId: string) => {
    const syl = syllabi[moduleId];
    if (!syl) return;
    const newLesson: SyllabusLesson = {
      order_index: syl.content.lessons.length,
      title: 'New Lesson Topic',
      description: '',
      key_topics: [],
    };
    const updatedLessons = [...syl.content.lessons, newLesson];
    await persistSyllabusLessons(moduleId, updatedLessons);
    startInlineEdit(updatedLessons.length - 1, newLesson);
  };

  const draftAddKeyTopic = () => {
    if (!topicDraft || !newTopicDraft.trim()) return;
    setTopicDraft({ ...topicDraft, key_topics: [...topicDraft.key_topics, newTopicDraft.trim()] });
    setNewTopicDraft('');
  };

  const draftRemoveKeyTopic = (ti: number) => {
    if (!topicDraft) return;
    setTopicDraft({ ...topicDraft, key_topics: topicDraft.key_topics.filter((_, i) => i !== ti) });
  };

  const handleSaveSyllabus = (moduleId: string, updatedSyl: Syllabus) => {
    setSyllabi(prev => ({ ...prev, [moduleId]: updatedSyl }));
    setEditingSyllabusId(null);
  };

  const handleDeleteSyllabus = async (mod: Module) => {
    const syl = syllabi[mod.id];
    if (!syl) return;
    if (!confirm('Delete this syllabus and all built lessons in this module?')) return;
    await supabase.from('syllabi').delete().eq('id', syl.id);
    setSyllabi(prev => {
      const next = { ...prev };
      delete next[mod.id];
      return next;
    });
    setLessons(prev => {
      const next = { ...prev };
      delete next[mod.id];
      return next;
    });
  };

  // ---------- Lessons ----------
  const handleBuildLesson = async (moduleId: string, lessonIdx: number) => {
    if (!course) return;
    if (!aiSettings) { alert('AI settings not loaded yet. Try again in a moment.'); return; }
    const syl = syllabi[moduleId];
    if (!syl) return;
    const sylLesson = syl.content.lessons[lessonIdx];
    const lessonId = `${moduleId}-${lessonIdx}`;
    setBuildingLessonId(lessonId);

    const existingLesson = lessons[moduleId]?.find(l => l.order_index === lessonIdx);
    const now = new Date().toISOString();

    try {
      const { content, quiz, prompt } = await generateLesson(
        aiSettings,
        course.topic,
        modules.find(m => m.id === moduleId)?.title ?? '',
        sylLesson.title,
        sylLesson.description,
        sylLesson.key_topics,
        course.content_language
      );

      const bgColor = pickColor(lessonIdx);
      const genFields = {
        last_generation_prompt: prompt,
        last_generation_status: 'success' as const,
        last_generation_error: null,
        last_generation_at: now,
      };

      let lesson: Lesson;
      if (existingLesson) {
        const { data } = await supabase
          .from('lessons')
          .update({ title: sylLesson.title, content, quiz, background_color: bgColor, generated_at: now, status: 'published', ...genFields })
          .eq('id', existingLesson.id)
          .select()
          .single();
        lesson = data!;
        setLessons(prev => ({
          ...prev,
          [moduleId]: prev[moduleId].map(l => l.id === lesson.id ? lesson : l)
        }));
      } else {
        const { data } = await supabase
          .from('lessons')
          .insert({
            module_id: moduleId,
            title: sylLesson.title,
            order_index: lessonIdx,
            content,
            quiz,
            background_color: bgColor,
            generated_at: now,
            status: 'published',
            ...genFields,
          })
          .select()
          .single();
        lesson = data!;
        setLessons(prev => ({
          ...prev,
          [moduleId]: [...(prev[moduleId] ?? []), lesson].sort((a, b) => a.order_index - b.order_index)
        }));
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      alert('Failed to build lesson: ' + errorMsg);

      if (existingLesson) {
        const { data } = await supabase
          .from('lessons')
          .update({ last_generation_status: 'failed', last_generation_error: errorMsg, last_generation_at: now })
          .eq('id', existingLesson.id)
          .select()
          .single();
        if (data) {
          setLessons(prev => ({
            ...prev,
            [moduleId]: prev[moduleId].map(l => l.id === data.id ? data : l)
          }));
        }
      }
    }
    setBuildingLessonId(null);
  };

  const handleBuildAllLessons = async (moduleId: string) => {
    const syl = syllabi[moduleId];
    if (!syl) return;
    for (let i = 0; i < syl.content.lessons.length; i++) {
      await handleBuildLesson(moduleId, i);
    }
  };

  const handleLessonSaved = (updated: Lesson) => {
    setLessons(prev => ({
      ...prev,
      [updated.module_id]: (prev[updated.module_id] ?? []).map(l => l.id === updated.id ? updated : l),
    }));
    setEditingLesson(null);
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm(`Delete lesson "${lesson.title}"? Students' progress on it will be lost.`)) return;
    await supabase.from('lessons').delete().eq('id', lesson.id);
    setLessons(prev => ({
      ...prev,
      [lesson.module_id]: (prev[lesson.module_id] ?? []).filter(l => l.id !== lesson.id),
    }));
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (!course) return null;

  const activeModule = modules.find(m => m.id === activeTab);
  const activeSyllabus = activeTab ? syllabi[activeTab] : null;
  const activeLessons = activeTab ? (lessons[activeTab] ?? []) : [];
  const totalLessons = Object.values(lessons).flat().length;
  const publishedLessons = Object.values(lessons).flat().filter(l => l.status === 'published').length;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <h1>{course.title}</h1>
          <p className="text-muted">{course.topic} · {course.objective}</p>
          <span className="badge lang-badge">Explained in: {languageLabel(course.content_language)}</span>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setEditingCourse(true)}>
          <Edit3 size={14} /> Edit Details
        </button>
        <span className={`badge ${course.status}`}>{course.status}</span>
      </div>

      {editingCourse && (
        <CourseEditModal course={course} onSave={handleCourseSaved} onClose={() => setEditingCourse(false)} />
      )}

      <div className="course-progress-bar">
        <ProgressBar
          percentage={totalLessons > 0 ? Math.round((publishedLessons / totalLessons) * 100) : 0}
          label={`Course Progress: ${publishedLessons}/${totalLessons} lessons built`}
          color="#6C63FF"
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
            {lessons[mod.id]?.length > 0 && (
              <span className="tab-lesson-count">{lessons[mod.id].filter(l => l.status === 'published').length}/{syllabi[mod.id]?.content.lessons.length ?? 0}</span>
            )}
          </button>
        ))}
        <button className="module-tab add-tab" onClick={() => setEditingModule('new')}>
          <Plus size={14} /> Add Module
        </button>
      </div>

      {editingModule && (
        <ModuleEditModal
          courseId={course.id}
          module={editingModule === 'new' ? null : editingModule}
          nextOrderIndex={modules.length}
          onSave={handleModuleSaved}
          onClose={() => setEditingModule(null)}
        />
      )}

      {/* Active Module Panel */}
      {activeModule && (
        <div className="module-panel">
          <div className="module-panel-header">
            <div>
              <h2>{activeModule.title}</h2>
              {activeModule.description && <p className="text-muted">{activeModule.description}</p>}
              {activeModule.level_target && <p className="text-muted">Target: {activeModule.level_target}</p>}
            </div>
            <div className="module-actions">
              <button className="btn-ghost btn-sm" onClick={() => setEditingModule(activeModule)}>
                <Settings2 size={14} /> Edit Module
              </button>
              <button className="btn-ghost btn-sm danger" onClick={() => handleDeleteModule(activeModule)}>
                <Trash2 size={14} /> Delete Module
              </button>
              {activeSyllabus && (
                <>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setEditingSyllabusId(activeModule.id)}
                  >
                    <Edit3 size={14} /> Edit Syllabus
                  </button>
                  <button className="btn-ghost btn-sm danger" onClick={() => handleDeleteSyllabus(activeModule)}>
                    <Trash2 size={14} /> Delete Syllabus
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleBuildAllLessons(activeModule.id)}
                    disabled={!!buildingLessonId}
                  >
                    <BookOpen size={14} /> Build All Lessons
                  </button>
                </>
              )}
              {!activeSyllabus && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleCreateSyllabusManually(activeModule)}
                >
                  <Edit3 size={14} /> Create Manually
                </button>
              )}
              <button
                className={`btn-secondary btn-sm ${!activeSyllabus ? 'btn-primary' : ''}`}
                onClick={() => handleGenerateSyllabus(activeModule)}
                disabled={generatingModuleId === activeModule.id}
              >
                {generatingModuleId === activeModule.id ? (
                  <><Spinner size={14} /> Generating…</>
                ) : (
                  <><Wand2 size={14} /> {activeSyllabus ? 'Regenerate with AI' : 'Generate with AI'}</>
                )}
              </button>
            </div>
          </div>

          {/* Module progress bar */}
          {activeSyllabus && (
            <ProgressBar
              percentage={activeSyllabus.content.lessons.length > 0
                ? Math.round((activeLessons.filter(l => l.status === 'published').length / activeSyllabus.content.lessons.length) * 100)
                : 0}
              label="Module build progress"
              color="#00C896"
            />
          )}

          {/* Syllabus Editor Modal */}
          {editingSyllabusId === activeModule.id && activeSyllabus && (
            <SyllabusEditor
              syllabus={activeSyllabus}
              onSave={syl => handleSaveSyllabus(activeModule.id, syl)}
              onClose={() => setEditingSyllabusId(null)}
            />
          )}

          {/* Lesson Editor Modal */}
          {editingLesson && (
            <LessonEditModal
              lesson={editingLesson}
              onSave={handleLessonSaved}
              onClose={() => setEditingLesson(null)}
            />
          )}

          {viewingGenLog && (
            <div className="modal-overlay" onClick={() => setViewingGenLog(null)}>
              <div className="modal-container" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>AI Generation Log — {viewingGenLog.title}</h2>
                  <button className="btn-ghost btn-icon" onClick={() => setViewingGenLog(null)}><XIcon size={18} /></button>
                </div>
                <div className="modal-body">
                  <p>
                    <strong>Status:</strong>{' '}
                    {viewingGenLog.last_generation_status === 'failed'
                      ? <span className="badge danger">Failed</span>
                      : <span className="badge published">Success</span>}
                  </p>
                  <p><strong>Run at:</strong> {viewingGenLog.last_generation_at ? new Date(viewingGenLog.last_generation_at).toLocaleString() : '—'}</p>
                  {viewingGenLog.last_generation_error && (
                    <p><strong>Error:</strong> {viewingGenLog.last_generation_error}</p>
                  )}
                  <p><strong>Prompt sent to AI:</strong></p>
                  <pre className="gen-log-prompt">{viewingGenLog.last_generation_prompt}</pre>
                </div>
                <div className="modal-footer">
                  <button className="btn-ghost" onClick={() => setViewingGenLog(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Syllabus + Lessons list */}
          {!activeSyllabus ? (
            <div className="empty-state small">
              <Wand2 size={32} />
              <p>No syllabus yet. Generate one with AI to get started.</p>
            </div>
          ) : (
            <div className="lessons-list">
              <div className="lessons-list-header">
                <h3>Lessons ({activeSyllabus.content.lessons.length})</h3>
                <button className="btn-ghost btn-sm" onClick={() => handleAddTopicInline(activeModule.id)} disabled={savingTopics}>
                  <Plus size={14} /> Add Lesson Topic
                </button>
              </div>
              {activeSyllabus.content.lessons.map((sylLesson, idx) => {
                const builtLesson = activeLessons.find(l => l.order_index === idx);
                const lessonId = `${activeModule.id}-${idx}`;
                const isBuilding = buildingLessonId === lessonId;
                const isEditing = inlineEditIdx === idx && topicDraft;

                if (isEditing && topicDraft) {
                  return (
                    <div key={idx} className="lesson-row editing" style={{ borderLeftColor: builtLesson?.background_color ?? '#ddd' }}>
                      <div className="lesson-row-info" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            value={topicDraft.title}
                            onChange={e => setTopicDraft({ ...topicDraft, title: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <input
                            value={topicDraft.description}
                            onChange={e => setTopicDraft({ ...topicDraft, description: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Key Topics</label>
                          <div className="lesson-topics">
                            {topicDraft.key_topics.map((t, ti) => (
                              <span key={ti} className="topic-chip removable">
                                {t}
                                <button onClick={() => draftRemoveKeyTopic(ti)} title="Remove topic"><XIcon size={12} /></button>
                              </span>
                            ))}
                          </div>
                          <div className="input-row" style={{ marginTop: 6 }}>
                            <input
                              value={newTopicDraft}
                              placeholder="Add a key topic…"
                              onChange={e => setNewTopicDraft(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); draftAddKeyTopic(); } }}
                            />
                            <button className="btn-ghost btn-sm" onClick={draftAddKeyTopic}><Plus size={14} /> Add</button>
                          </div>
                        </div>
                      </div>
                      <div className="lesson-row-actions">
                        <button className="btn-primary btn-sm" onClick={() => saveInlineEdit(activeModule.id, idx)} disabled={savingTopics}>
                          <Save size={14} /> Save
                        </button>
                        <button className="btn-ghost btn-sm" onClick={cancelInlineEdit}>
                          <XIcon size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="lesson-row" style={{ borderLeftColor: builtLesson?.background_color ?? '#ddd' }}>
                    <div className="lesson-row-info">
                      <span className="lesson-number">{idx + 1}</span>
                      <div>
                        <p className="lesson-title">{sylLesson.title}</p>
                        <p className="lesson-desc text-muted">{sylLesson.description}</p>
                        <div className="lesson-topics">
                          {sylLesson.key_topics.map((t, ti) => (
                            <span key={ti} className="topic-chip">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="lesson-row-actions">
                      <div className="reorder-btns">
                        <button className="btn-ghost btn-icon" title="Move up" disabled={idx === 0 || savingTopics} onClick={() => handleMoveTopic(activeModule.id, idx, -1)}>
                          <ChevronUp size={14} />
                        </button>
                        <button className="btn-ghost btn-icon" title="Move down" disabled={idx === activeSyllabus.content.lessons.length - 1 || savingTopics} onClick={() => handleMoveTopic(activeModule.id, idx, 1)}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => startInlineEdit(idx, sylLesson)}
                        title="Edit topic title, description and key topics"
                      >
                        <Edit3 size={14} /> Edit Topic
                      </button>
                      <button
                        className="btn-ghost btn-sm danger"
                        onClick={() => handleDeleteTopic(activeModule.id, idx, sylLesson.title)}
                        title="Delete this lesson topic from the syllabus"
                      >
                        <Trash2 size={14} />
                      </button>
                      {builtLesson ? (
                        <>
                          <CheckCircle size={16} className="icon-green" />
                          {builtLesson.last_generation_at && (
                            <button
                              className="btn-ghost btn-icon"
                              onClick={() => setViewingGenLog(builtLesson)}
                              title={`AI generation: ${builtLesson.last_generation_status} — click for details`}
                            >
                              {builtLesson.last_generation_status === 'failed'
                                ? <AlertTriangle size={14} className="icon-orange" />
                                : <History size={14} />}
                            </button>
                          )}
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => navigate(`/admin/preview/courses/${course.id}/lessons/${builtLesson.id}`)}
                            title="Preview / play this lesson as it appears to students"
                          >
                            <PlayCircle size={14} /> Preview
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => setEditingLesson(builtLesson)}
                            title="Edit lesson content"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => handleBuildLesson(activeModule.id, idx)}
                            disabled={isBuilding}
                            title="Rebuild lesson with AI"
                          >
                            {isBuilding ? <Spinner size={14} /> : <RefreshCw size={14} />}
                          </button>
                          <button
                            className="btn-ghost btn-sm danger"
                            onClick={() => handleDeleteLesson(builtLesson)}
                            title="Delete lesson"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleBuildLesson(activeModule.id, idx)}
                          disabled={isBuilding}
                        >
                          {isBuilding ? <><Spinner size={14} /> Building…</> : <><Wand2 size={14} /> Build</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Syllabus overview */}
          {activeSyllabus && (
            <div className="syllabus-overview">
              <h4>Module Overview</h4>
              <p>{activeSyllabus.content.overview}</p>
              <h4>Learning Outcomes</h4>
              <ul>
                {activeSyllabus.content.learning_outcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
