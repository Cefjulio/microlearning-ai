import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Syllabus, SyllabusLesson } from '../../types';
import { Plus, Trash2, X } from 'lucide-react';

interface Props {
  syllabus: Syllabus;
  onSave: (updated: Syllabus) => void;
  onClose: () => void;
}

export default function SyllabusEditor({ syllabus, onSave, onClose }: Props) {
  const [overview, setOverview] = useState(syllabus.content.overview);
  const [outcomes, setOutcomes] = useState<string[]>([...syllabus.content.learning_outcomes]);
  const [lessons, setLessons] = useState<SyllabusLesson[]>(
    syllabus.content.lessons.map(l => ({ ...l, key_topics: [...l.key_topics] }))
  );
  const [saving, setSaving] = useState(false);

  const updateLesson = (i: number, field: keyof SyllabusLesson, value: string | string[] | number) => {
    setLessons(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const addLesson = () => {
    setLessons(prev => [...prev, {
      order_index: prev.length,
      title: '',
      description: '',
      key_topics: [],
    }]);
  };

  const removeLesson = (i: number) => {
    if (!confirm('Remove this lesson topic from the syllabus?')) return;
    setLessons(prev => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, order_index: idx })));
  };

  const moveLesson = (i: number, dir: -1 | 1) => {
    setLessons(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((l, idx) => ({ ...l, order_index: idx }));
    });
  };

  const addKeyTopic = (lessonIdx: number) => {
    setLessons(prev => prev.map((l, idx) =>
      idx === lessonIdx ? { ...l, key_topics: [...l.key_topics, ''] } : l
    ));
  };

  const updateKeyTopic = (lessonIdx: number, topicIdx: number, value: string) => {
    setLessons(prev => prev.map((l, idx) =>
      idx === lessonIdx
        ? { ...l, key_topics: l.key_topics.map((t, ti) => ti === topicIdx ? value : t) }
        : l
    ));
  };

  const removeKeyTopic = (lessonIdx: number, topicIdx: number) => {
    setLessons(prev => prev.map((l, idx) =>
      idx === lessonIdx
        ? { ...l, key_topics: l.key_topics.filter((_, ti) => ti !== topicIdx) }
        : l
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    const updatedContent = { overview, learning_outcomes: outcomes, lessons };
    const { data } = await supabase
      .from('syllabi')
      .update({ content: updatedContent, edited_at: new Date().toISOString() })
      .eq('id', syllabus.id)
      .select()
      .single();
    if (data) onSave(data);
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container large">
        <div className="modal-header">
          <h2>Edit Syllabus</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p className="text-muted" style={{ marginTop: -4, marginBottom: 12 }}>
            Everything below is fully editable. Tweak anything the AI generated, delete what you don't
            need, or skip AI entirely and build the syllabus by hand using the "Add" buttons in each section.
          </p>

          <div className="form-group">
            <label>Module Overview</label>
            <textarea value={overview} onChange={e => setOverview(e.target.value)} rows={3} />
          </div>

          <div className="form-group">
            <div className="section-header">
              <label>Learning Outcomes ({outcomes.length})</label>
              <button className="btn-ghost btn-sm" onClick={() => setOutcomes(prev => [...prev, ''])}>
                <Plus size={14} /> Add Outcome
              </button>
            </div>
            {outcomes.length === 0 && <p className="text-muted">No outcomes yet — add one manually or regenerate with AI.</p>}
            {outcomes.map((o, i) => (
              <div key={i} className="input-row">
                <input
                  value={o}
                  placeholder="e.g. Confidently order food in a restaurant"
                  onChange={e => setOutcomes(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
                />
                <button
                  className="btn-ghost btn-icon danger"
                  title="Remove outcome"
                  onClick={() => setOutcomes(prev => prev.filter((_, xi) => xi !== i))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="form-group">
            <div className="section-header">
              <label>Lessons / Topics ({lessons.length})</label>
              <button className="btn-ghost btn-sm" onClick={addLesson}><Plus size={14} /> Add Lesson Topic</button>
            </div>
            {lessons.length === 0 && <p className="text-muted">No lesson topics yet — add one manually or regenerate with AI.</p>}
            {lessons.map((lesson, i) => (
              <div key={i} className="syllabus-lesson-editor">
                <div className="syllabus-lesson-header">
                  <span className="lesson-number">{i + 1}</span>
                  <div className="syllabus-lesson-header-actions">
                    <button className="btn-ghost btn-icon" title="Move up" disabled={i === 0} onClick={() => moveLesson(i, -1)}>↑</button>
                    <button className="btn-ghost btn-icon" title="Move down" disabled={i === lessons.length - 1} onClick={() => moveLesson(i, 1)}>↓</button>
                    <button className="btn-ghost btn-icon danger" title="Remove this lesson topic" onClick={() => removeLesson(i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Title</label>
                    <input value={lesson.title} placeholder="Lesson title" onChange={e => updateLesson(i, 'title', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input value={lesson.description} placeholder="What this lesson covers" onChange={e => updateLesson(i, 'description', e.target.value)} />
                </div>
                <div className="form-group">
                  <div className="section-header">
                    <label>Key Topics ({lesson.key_topics.length})</label>
                    <button className="btn-ghost btn-sm" onClick={() => addKeyTopic(i)}><Plus size={14} /> Add Topic</button>
                  </div>
                  {lesson.key_topics.length === 0 && <p className="text-muted">No key topics yet.</p>}
                  {lesson.key_topics.map((topic, ti) => (
                    <div key={ti} className="input-row">
                      <input
                        value={topic}
                        placeholder="e.g. Past tense verbs"
                        onChange={e => updateKeyTopic(i, ti, e.target.value)}
                      />
                      <button
                        className="btn-ghost btn-icon danger"
                        title="Remove topic"
                        onClick={() => removeKeyTopic(i, ti)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn-ghost btn-sm" onClick={addLesson}>
              <Plus size={14} /> Add Another Lesson Topic
            </button>
          </div>
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
