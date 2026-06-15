import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Course } from '../../types';
import { X } from 'lucide-react';
import { CONTENT_LANGUAGES } from '../../lib/languages';

interface Props {
  course: Course;
  onSave: (updated: Course) => void;
  onClose: () => void;
}

export default function CourseEditModal({ course, onSave, onClose }: Props) {
  const [title, setTitle] = useState(course.title);
  const [topic, setTopic] = useState(course.topic);
  const [objective, setObjective] = useState(course.objective);
  const [description, setDescription] = useState(course.description ?? '');
  const [contentLanguage, setContentLanguage] = useState(course.content_language ?? 'en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim() || !topic.trim() || !objective.trim()) {
      setError('Title, topic, and objective are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('courses')
      .update({ title, topic, objective, description: description || null, content_language: contentLanguage })
      .eq('id', course.id)
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to save changes');
      setSaving(false);
      return;
    }
    onSave(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Edit Course Details</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Course Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Topic *</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Learning Objective *</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="form-group">
            <label>Explanation Language</label>
            <select value={contentLanguage} onChange={e => setContentLanguage(e.target.value)}>
              {CONTENT_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-muted" style={{ marginTop: 6 }}>
              Language used for AI-generated explanations, summaries and quiz text — independent of the
              subject being taught (e.g. an English course can be explained in Spanish).
            </p>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
