import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Course } from '../../types';
import { BookOpen, Plus, CheckCircle, Clock, Copy, X } from 'lucide-react';
import { CONTENT_LANGUAGES, languageLabel } from '../../lib/languages';

export default function AdminDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<Course | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    setCourses(data ?? []);
    setLoading(false);
  };

  const togglePublish = async (course: Course) => {
    const newStatus = course.status === 'published' ? 'draft' : 'published';
    await supabase.from('courses').update({ status: newStatus }).eq('id', course.id);
    setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: newStatus } : c));
  };

  const handleDuplicate = async (original: Course, newTitle: string, newLanguage: string) => {
    // 1. Clone the course shell
    const { data: newCourse, error: courseErr } = await supabase
      .from('courses')
      .insert({
        title: newTitle,
        topic: original.topic,
        objective: original.objective,
        description: original.description,
        content_language: newLanguage,
        created_by: original.created_by,
        status: 'draft',
      })
      .select()
      .single();

    if (courseErr || !newCourse) {
      alert('Failed to duplicate course: ' + (courseErr?.message ?? 'unknown error'));
      return;
    }

    // 2. Clone modules
    const { data: origModules } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', original.id)
      .order('order_index');

    if (origModules && origModules.length > 0) {
      const moduleRows = origModules.map(m => ({
        course_id: newCourse.id,
        title: m.title,
        description: m.description,
        level_target: m.level_target,
        order_index: m.order_index,
      }));
      const { data: newModules } = await supabase.from('modules').insert(moduleRows).select();

      // 3. Clone syllabi (lessons are intentionally NOT copied — they should be
      //    rebuilt with AI in the new explanation language, or written manually)
      if (newModules) {
        const { data: origSyllabi } = await supabase
          .from('syllabi')
          .select('*')
          .in('module_id', origModules.map(m => m.id));

        if (origSyllabi && origSyllabi.length > 0) {
          const syllabusRows = origSyllabi.map(s => {
            const origModIdx = origModules.findIndex(m => m.id === s.module_id);
            const newModuleId = newModules[origModIdx]?.id;
            return newModuleId ? { module_id: newModuleId, content: s.content } : null;
          }).filter(Boolean);

          if (syllabusRows.length > 0) {
            await supabase.from('syllabi').insert(syllabusRows as { module_id: string; content: object }[]);
          }
        }
      }
    }

    setCourses(prev => [newCourse, ...prev]);
    setDuplicating(null);
    navigate(`/admin/courses/${newCourse.id}`);
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course and all its content?')) return;
    await supabase.from('courses').delete().eq('id', id);
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="text-muted">Manage your courses and content</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/admin/courses/new')}>
          <Plus size={16} /> New Course
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <BookOpen size={24} className="stat-icon" />
          <div>
            <p className="stat-value">{courses.length}</p>
            <p className="stat-label">Total Courses</p>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle size={24} className="stat-icon green" />
          <div>
            <p className="stat-value">{courses.filter(c => c.status === 'published').length}</p>
            <p className="stat-label">Published</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={24} className="stat-icon orange" />
          <div>
            <p className="stat-value">{courses.filter(c => c.status === 'draft').length}</p>
            <p className="stat-label">Drafts</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading courses…</div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <h3>No courses yet</h3>
          <p>Create your first course to get started</p>
          <button className="btn-primary" onClick={() => navigate('/admin/courses/new')}>
            Create Course
          </button>
        </div>
      ) : (
        <div className="course-grid">
          {courses.map(course => (
            <div key={course.id} className="course-card">
              <div className="course-card-header">
                <span className={`badge ${course.status}`}>{course.status}</span>
                <div className="course-card-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => navigate(`/admin/courses/${course.id}`)}
                  >
                    Manage
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => togglePublish(course)}
                  >
                    {course.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setDuplicating(course)}
                    title="Duplicate this course (e.g. to create a translated version)"
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    className="btn-ghost btn-sm danger"
                    onClick={() => deleteCourse(course.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <h3 className="course-card-title">{course.title}</h3>
              <p className="course-card-topic">{course.topic}</p>
              <p className="course-card-desc">{course.description}</p>
              <p className="course-card-objective text-muted">🎯 {course.objective}</p>
              <span className="badge lang-badge">Explained in: {languageLabel(course.content_language)}</span>
            </div>
          ))}
        </div>
      )}

      {duplicating && (
        <DuplicateCourseModal
          course={duplicating}
          onConfirm={(title, lang) => handleDuplicate(duplicating, title, lang)}
          onClose={() => setDuplicating(null)}
        />
      )}
    </div>
  );
}

interface DuplicateModalProps {
  course: Course;
  onConfirm: (newTitle: string, newLanguage: string) => void;
  onClose: () => void;
}

function DuplicateCourseModal({ course, onConfirm, onClose }: DuplicateModalProps) {
  const [title, setTitle] = useState(`${course.title} (Copy)`);
  const [language, setLanguage] = useState(course.content_language);
  const [working, setWorking] = useState(false);

  const handleConfirm = () => {
    if (!title.trim()) return;
    setWorking(true);
    onConfirm(title.trim(), language);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Duplicate Course</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted" style={{ marginTop: -4 }}>
            This creates a new draft course with the same topic, objective, modules, and syllabi
            as <strong>{course.title}</strong>. Lessons are <strong>not</strong> copied — build them fresh
            with AI in the new explanation language (or write them manually), so the content actually
            matches your chosen audience.
          </p>
          <div className="form-group">
            <label>New Course Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Explanation Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {CONTENT_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-muted" style={{ marginTop: 6 }}>
              Pick the language the new copy should be explained in — e.g. choose Spanish to create a
              Spanish-explained version of an English course for Spanish-speaking learners.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={working}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={working || !title.trim()}>
            {working ? 'Duplicating…' : 'Duplicate Course'}
          </button>
        </div>
      </div>
    </div>
  );
}
