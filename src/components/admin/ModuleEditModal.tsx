import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Module } from '../../types';
import { X } from 'lucide-react';

interface Props {
  courseId: string;
  module: Module | null; // null = creating new
  nextOrderIndex: number;
  onSave: (saved: Module, isNew: boolean) => void;
  onClose: () => void;
}

export default function ModuleEditModal({ courseId, module, nextOrderIndex, onSave, onClose }: Props) {
  const [title, setTitle] = useState(module?.title ?? '');
  const [description, setDescription] = useState(module?.description ?? '');
  const [levelTarget, setLevelTarget] = useState(module?.level_target ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Module title is required.');
      return;
    }
    setSaving(true);
    setError(null);

    if (module) {
      const { data, error: err } = await supabase
        .from('modules')
        .update({ title, description: description || null, level_target: levelTarget || null })
        .eq('id', module.id)
        .select()
        .single();
      if (err || !data) { setError(err?.message ?? 'Failed to save'); setSaving(false); return; }
      onSave(data, false);
    } else {
      const { data, error: err } = await supabase
        .from('modules')
        .insert({
          course_id: courseId,
          title,
          description: description || null,
          level_target: levelTarget || null,
          order_index: nextOrderIndex,
        })
        .select()
        .single();
      if (err || !data) { setError(err?.message ?? 'Failed to create'); setSaving(false); return; }
      onSave(data, true);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{module ? 'Edit Module' : 'Add Module'}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Module Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Module 1: A1 Beginner" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this module covers" />
          </div>
          <div className="form-group">
            <label>Level Target</label>
            <input value={levelTarget} onChange={e => setLevelTarget(e.target.value)} placeholder="e.g. A1, Beginner, Chapter 1" />
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : module ? 'Save Changes' : 'Add Module'}
          </button>
        </div>
      </div>
    </div>
  );
}
