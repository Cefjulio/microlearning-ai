import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { CONTENT_LANGUAGES } from '../../lib/languages';

interface ModuleInput {
  title: string;
  description: string;
  level_target: string;
}

export default function NewCoursePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [contentLanguage, setContentLanguage] = useState('en');
  const [modules, setModules] = useState<ModuleInput[]>([
    { title: '', description: '', level_target: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addModule = () =>
    setModules(prev => [...prev, { title: '', description: '', level_target: '' }]);

  const removeModule = (i: number) =>
    setModules(prev => prev.filter((_, idx) => idx !== i));

  const updateModule = (i: number, field: keyof ModuleInput, value: string) =>
    setModules(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (modules.some(m => !m.title.trim())) {
      setError('Each module must have a title.');
      return;
    }
    setSaving(true);
    setError(null);

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .insert({ title, topic, objective, description, content_language: contentLanguage, created_by: user.id })
      .select()
      .single();

    if (courseErr || !course) {
      setError(courseErr?.message ?? 'Failed to create course');
      setSaving(false);
      return;
    }

    const moduleRows = modules.map((m, i) => ({
      course_id: course.id,
      title: m.title,
      description: m.description || null,
      level_target: m.level_target || null,
      order_index: i,
    }));

    const { error: modErr } = await supabase.from('modules').insert(moduleRows);
    if (modErr) {
      setError(modErr.message);
      setSaving(false);
      return;
    }

    navigate(`/admin/courses/${course.id}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Create New Course</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        <section className="form-section">
          <h2>Course Details</h2>

          <div className="form-group">
            <label>Course Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. English from Zero to Expert"
              required
            />
          </div>

          <div className="form-group">
            <label>Topic *</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. English Language"
              required
            />
          </div>

          <div className="form-group">
            <label>Learning Objective *</label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="e.g. To go from 0 to expert in English"
              rows={2}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the course for students"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Explanation Language</label>
            <select value={contentLanguage} onChange={e => setContentLanguage(e.target.value)}>
              {CONTENT_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-muted" style={{ marginTop: 6 }}>
              This is the language the AI will use for explanations, summaries, and quiz instructions —
              <strong> not</strong> necessarily the subject being taught. For example, you can create an
              "English" course (where vocabulary, grammar, and examples stay in English) but have the AI
              explain everything in Spanish for Spanish-speaking learners. Just make that clear in the
              Topic/Objective above (e.g. "Teach English to Spanish speakers").
            </p>
          </div>
        </section>

        <section className="form-section">
          <div className="section-header">
            <h2>Modules</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={addModule}>
              <Plus size={14} /> Add Module
            </button>
          </div>
          <p className="text-muted">Each module represents a learning level or phase within the course.</p>

          {modules.map((mod, i) => (
            <div key={i} className="module-input-card">
              <div className="module-input-header">
                <span className="module-number">Module {i + 1}</span>
                {modules.length > 1 && (
                  <button type="button" className="btn-ghost btn-sm danger" onClick={() => removeModule(i)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Module Title *</label>
                <input
                  value={mod.title}
                  onChange={e => updateModule(i, 'title', e.target.value)}
                  placeholder="e.g. Module 1: A1 Beginner"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Description</label>
                  <input
                    value={mod.description}
                    onChange={e => updateModule(i, 'description', e.target.value)}
                    placeholder="What this module covers"
                  />
                </div>
                <div className="form-group">
                  <label>Level Target</label>
                  <input
                    value={mod.level_target}
                    onChange={e => updateModule(i, 'level_target', e.target.value)}
                    placeholder="e.g. A1, Beginner, Chapter 1"
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        {error && <p className="error-msg">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate('/admin')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
}
