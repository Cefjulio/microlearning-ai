import { useEffect, useState } from 'react';
import { getAppSettings, saveAppSettings } from '../../lib/ai';
import type { AIProvider, AppSettings } from '../../types';
import { Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

const PROVIDERS: { id: AIProvider; label: string; keyField: keyof AppSettings; placeholder: string; helpUrl: string }[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)', keyField: 'anthropic_api_key', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', label: 'ChatGPT (OpenAI)', keyField: 'openai_api_key', placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Gemini (Google AI)', keyField: 'gemini_api_key', placeholder: 'AIza...', helpUrl: 'https://aistudio.google.com/app/apikey' },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const data = await getAppSettings();
    if (data) {
      setSettings(data);
      setProvider(data.preferred_provider);
      setKeys({
        anthropic_api_key: data.anthropic_api_key ?? '',
        openai_api_key: data.openai_api_key ?? '',
        gemini_api_key: data.gemini_api_key ?? '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const updated = await saveAppSettings({
      preferred_provider: provider,
      anthropic_api_key: keys.anthropic_api_key || null,
      openai_api_key: keys.openai_api_key || null,
      gemini_api_key: keys.gemini_api_key || null,
    });
    if (updated) {
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading) return <div className="page"><p className="text-muted">Loading settings…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>AI Settings</h1>
          <p className="text-muted">Choose which AI provider generates your syllabi and lessons</p>
        </div>
      </div>

      <div className="form-container">
        <section className="form-section">
          <h2>Active Provider</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            This is the model that will be used whenever you generate a syllabus or build a lesson.
          </p>

          <div className="provider-options">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                className={`provider-option ${provider === p.id ? 'active' : ''}`}
                onClick={() => setProvider(p.id)}
              >
                <span className="provider-radio">{provider === p.id && <span className="provider-radio-dot" />}</span>
                <span>
                  <strong>{p.label}</strong>
                  {settings?.[p.keyField] ? (
                    <span className="key-status configured"><CheckCircle size={12} /> Key configured</span>
                  ) : (
                    <span className="key-status missing">No key set</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="form-section">
          <h2>API Keys</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Keys are stored securely in your database and only accessible to admins.
          </p>

          {PROVIDERS.map(p => (
            <div className="form-group" key={p.id}>
              <label>
                {p.label} API Key{' '}
                <a href={p.helpUrl} target="_blank" rel="noreferrer" className="inline-link">Get a key →</a>
              </label>
              <div className="key-input-row">
                <input
                  type={showKey[p.id] ? 'text' : 'password'}
                  value={keys[p.keyField] ?? ''}
                  onChange={e => setKeys(prev => ({ ...prev, [p.keyField]: e.target.value }))}
                  placeholder={p.placeholder}
                />
                <button
                  type="button"
                  className="btn-ghost btn-icon"
                  onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                >
                  {showKey[p.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </section>

        <div className="form-actions">
          {saved && <span className="auth-message" style={{ alignSelf: 'center' }}><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Saved!</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
