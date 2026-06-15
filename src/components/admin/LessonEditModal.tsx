import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lesson, LessonContent } from '../../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props {
  lesson: Lesson;
  onSave: (updated: Lesson) => void;
  onClose: () => void;
}

const COLOR_SWATCHES = [
  '#FFD6E0', '#FFDDC1', '#C1F0DC', '#C1E0FF',
  '#E8D5FF', '#FFFAC1', '#D5F5E3', '#FAD7A0',
  '#AED6F1', '#F9E4B7',
];

export default function LessonEditModal({ lesson, onSave, onClose }: Props) {
  const [title, setTitle] = useState(lesson.title);
  const [bgColor, setBgColor] = useState(lesson.background_color);
  const [imageUrl, setImageUrl] = useState(lesson.image_url ?? '');
  const [status, setStatus] = useState(lesson.status);
  const [content, setContent] = useState<LessonContent>(
    lesson.content ?? { summary: '', explanation: '', examples: [], key_points: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateExample = (i: number, field: 'title' | 'content', value: string) => {
    setContent(prev => ({
      ...prev,
      examples: prev.examples.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex),
    }));
  };

  const addExample = () => setContent(prev => ({ ...prev, examples: [...prev.examples, { title: '', content: '' }] }));
  const removeExample = (i: number) => setContent(prev => ({ ...prev, examples: prev.examples.filter((_, idx) => idx !== i) }));

  const updateKeyPoint = (i: number, value: string) => {
    setContent(prev => ({ ...prev, key_points: prev.key_points.map((kp, idx) => idx === i ? value : kp) }));
  };
  const addKeyPoint = () => setContent(prev => ({ ...prev, key_points: [...prev.key_points, ''] }));
  const removeKeyPoint = (i: number) => setContent(prev => ({ ...prev, key_points: prev.key_points.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!title.trim()) { setError('Lesson title is required.'); return; }
    setSaving(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('lessons')
      .update({
        title,
        background_color: bgColor,
        image_url: imageUrl || null,
        status,
        content,
      })
      .eq('id', lesson.id)
      .select()
      .single();

    if (err || !data) { setError(err?.message ?? 'Failed to save'); setSaving(false); return; }
    onSave(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container large">
        <div className="modal-header">
          <h2>Edit Lesson</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Lesson Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'published')}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="form-group">
              <label>Hero Image URL</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="form-group">
            <label>Background Color (juvenile theme)</label>
            <div className="color-swatches">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${bgColor === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setBgColor(c)}
                />
              ))}
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                className="color-custom-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Summary</label>
            <textarea value={content.summary} onChange={e => setContent(prev => ({ ...prev, summary: e.target.value }))} rows={2} />
          </div>

          <div className="form-group">
            <label>Explanation (Markdown supported)</label>
            <textarea value={content.explanation} onChange={e => setContent(prev => ({ ...prev, explanation: e.target.value }))} rows={8} />
          </div>

          <div className="form-group">
            <div className="section-header">
              <label>Examples</label>
              <button type="button" className="btn-ghost btn-sm" onClick={addExample}><Plus size={14} /> Add Example</button>
            </div>
            {content.examples.map((ex, i) => (
              <div key={i} className="syllabus-lesson-editor">
                <div className="syllabus-lesson-header">
                  <span className="lesson-number">{i + 1}</span>
                  <button className="btn-ghost btn-icon danger" onClick={() => removeExample(i)}><Trash2 size={14} /></button>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input value={ex.title} onChange={e => updateExample(i, 'title', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Content</label>
                  <textarea value={ex.content} onChange={e => updateExample(i, 'content', e.target.value)} rows={2} />
                </div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <div className="section-header">
              <label>Key Points</label>
              <button type="button" className="btn-ghost btn-sm" onClick={addKeyPoint}><Plus size={14} /> Add Key Point</button>
            </div>
            {content.key_points.map((kp, i) => (
              <div key={i} className="input-row">
                <input value={kp} onChange={e => updateKeyPoint(i, e.target.value)} />
                <button className="btn-ghost btn-icon" onClick={() => removeKeyPoint(i)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <p className="text-muted" style={{ marginTop: 4 }}>
            Note: To edit quiz questions, rebuild the lesson via AI generation — quiz editing UI coming in a future update.
          </p>

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
