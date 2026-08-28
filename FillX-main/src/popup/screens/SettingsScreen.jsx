import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Server, Trash2, User, LogOut, ShieldCheck } from 'lucide-react';
import { getSettings, updateSettings, clearProfile } from '../../utils/storage.js';
import { getAuthSession } from '../../utils/auth.js';

export default function SettingsScreen({ onProfileCleared, onSignOut }) {
  const [settings, setSettings] = useState({
    highlightMatched: true,
    highlightAmbiguous: true,
    highlightUnmatched: true,
    autoPromptSave: true,
    backendUrl: 'http://localhost:3000',
  });
  const [clearedNotice, setClearedNotice] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getSettings().then(setSettings);
    getAuthSession().then((session) => {
      if (session?.user) setCurrentUser(session.user);
    });
  }, []);

  const handleToggle = async (key) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await updateSettings({ [key]: updated[key] });
  };

  const handleBackendChange = async (e) => {
    const val = e.target.value;
    setSettings((s) => ({ ...s, backendUrl: val }));
    await updateSettings({ backendUrl: val });
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to reset your stored profile data?')) {
      await clearProfile();
      setClearedNotice(true);
      if (onProfileCleared) onProfileCleared();
      setTimeout(() => setClearedNotice(false), 2000);
    }
  };

  return (
    <section className="settings-screen">
      <div className="screen-heading compact">
        <p className="eyebrow-text">PREFERENCES</p>
        <h1 className="font-display">Settings</h1>
        <p>Manage your FillX preferences and active account.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Active Account Card */}
        {currentUser && (
          <div className="card-surface">
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} color="var(--color-primary)" />
              <span>Active Account</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 12, display: 'block', color: 'var(--color-text-primary)' }}>
                  {currentUser.name || 'User'}
                </strong>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {currentUser.email}
                </span>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    color: '#dc2626',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={12} />
                  <span>Switch Account</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Highlighting Toggles */}
        <div className="card-surface">
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={14} color="var(--color-primary)" />
            <span>Visual Highlighting</span>
          </div>

          {[
            ['highlightMatched', 'Highlight Matched Fields (Green)', settings.highlightMatched],
            ['highlightAmbiguous', 'Highlight Ambiguous Fields (Amber)', settings.highlightAmbiguous],
            ['highlightUnmatched', 'Highlight Unmatched Fields (Red)', settings.highlightUnmatched],
            ['autoPromptSave', 'Prompt to Save Manually Filled Fields', settings.autoPromptSave],
          ].map(([key, label, checked]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 0',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(key)}
                style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>

        {/* Backend Configuration */}
        <div className="card-surface">
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Server size={14} color="var(--color-primary)" />
            <span>AI Backend API Endpoint</span>
          </div>
          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Next.js API server for Gemini LLM extraction &amp; matching:
          </p>
          <input
            value={settings.backendUrl}
            onChange={handleBackendChange}
            placeholder="http://localhost:3000"
            style={{ fontSize: 11, width: '100%' }}
          />
        </div>

        {/* Clear Data Action */}
        <div className="card-surface">
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} />
            <span>Reset Active Profile</span>
          </div>
          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Erases all stored personal data and custom fields for this active account.
          </p>
          <button
            type="button"
            onClick={handleClearAllData}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#dc2626',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Clear Stored Profile Data
          </button>
          {clearedNotice && (
            <div style={{ fontSize: 11, color: '#059669', textAlign: 'center', marginTop: 6, fontWeight: 700 }}>
              ✓ Profile storage cleared
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
