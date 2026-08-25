/**
 * ProfileTab.jsx — Member 4: Data / QA / Deployment Lead
 *
 * The "Profile" screen in the popup. Shows all stored profile fields in an
 * editable list. Users can edit any field, add a new custom field, or delete
 * a custom field. Changes are written to chrome.storage.local via storage.js.
 *
 * Props: none (reads storage directly on mount)
 */

import { useState, useEffect, useCallback } from 'react';
import { getProfile, updateField, saveCustomField, deleteField } from './storage.js';

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single editable field row */
function FieldRow({ label, fieldPath, value, onSave, onDelete, deletable = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    onSave(fieldPath, draft);
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      {editing ? (
        <div className="field-edit">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="field-input"
          />
          <button onClick={handleSave} className="btn btn-save">✓</button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="btn btn-cancel">✕</button>
        </div>
      ) : (
        <div className="field-display">
          <span className={`field-value ${!value ? 'empty' : ''}`}>
            {value || '—'}
          </span>
          <button onClick={() => setEditing(true)} className="btn btn-edit">Edit</button>
          {deletable && (
            <button onClick={() => onDelete(fieldPath)} className="btn btn-delete">🗑</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible section wrapper */
function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="section">
      <button className="section-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="section-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileTab() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saved', 'error'

  // Load profile on mount
  useEffect(() => {
    getProfile()
      .then((p) => { setProfile(p); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const showSaved = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 1500);
  };

  const handleSave = useCallback(async (path, value) => {
    try {
      await updateField(path, value);
      // Update local state so UI reflects change without re-fetching
      setProfile((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        const keys = path.split('.');
        let cursor = updated;
        for (let i = 0; i < keys.length - 1; i++) cursor = cursor[keys[i]];
        cursor[keys[keys.length - 1]] = value;
        return updated;
      });
      showSaved();
    } catch (err) {
      setError('Failed to save: ' + err.message);
    }
  }, []);

  const handleDeleteCustom = useCallback(async (key) => {
    try {
      await deleteField(`custom.${key}`);
      setProfile((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        delete updated.custom[key];
        return updated;
      });
    } catch (err) {
      setError('Failed to delete: ' + err.message);
    }
  }, []);

  const handleAddCustom = async () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, '_');
    try {
      await saveCustomField(key, newValue.trim());
      setProfile((prev) => ({
        ...prev,
        custom: { ...prev.custom, [key]: newValue.trim() },
      }));
      setNewKey('');
      setNewValue('');
      setAddingCustom(false);
      showSaved();
    } catch (err) {
      setError('Failed to add field: ' + err.message);
    }
  };

  // ── Render states ──

  if (loading) {
    return <div className="tab-loading">Loading profile…</div>;
  }

  if (error) {
    return (
      <div className="tab-error">
        <p>⚠️ {error}</p>
        <button onClick={() => setError(null)} className="btn">Dismiss</button>
      </div>
    );
  }

  if (!profile || !profile.meta?.lastUpdated) {
    return (
      <div className="tab-empty">
        <p>No profile yet. Go to the <strong>Document</strong> tab and upload a file to get started.</p>
      </div>
    );
  }

  const { personal, address, education, experience, skills, languages, links, custom } = profile;

  return (
    <div className="profile-tab">
      {saveStatus === 'saved' && <div className="save-toast">✓ Saved</div>}

      {/* ── Personal ── */}
      <Section title="Personal">
        {[
          ['First Name', 'personal.firstName', personal.firstName],
          ['Last Name', 'personal.lastName', personal.lastName],
          ['Full Name', 'personal.fullName', personal.fullName],
          ['Email', 'personal.email', personal.email],
          ['Phone', 'personal.phone', personal.phone],
          ['Date of Birth', 'personal.dateOfBirth', personal.dateOfBirth],
          ['Nationality', 'personal.nationality', personal.nationality],
        ].map(([label, path, value]) => (
          <FieldRow key={path} label={label} fieldPath={path} value={value} onSave={handleSave} />
        ))}
      </Section>

      {/* ── Address ── */}
      <Section title="Address">
        {[
          ['Street', 'address.street', address.street],
          ['City', 'address.city', address.city],
          ['State / Province', 'address.state', address.state],
          ['ZIP / Postal Code', 'address.zip', address.zip],
          ['Country', 'address.country', address.country],
        ].map(([label, path, value]) => (
          <FieldRow key={path} label={label} fieldPath={path} value={value} onSave={handleSave} />
        ))}
      </Section>

      {/* ── Links ── */}
      <Section title="Links">
        {[
          ['LinkedIn', 'links.linkedin', links.linkedin],
          ['GitHub', 'links.github', links.github],
          ['Portfolio', 'links.portfolio', links.portfolio],
        ].map(([label, path, value]) => (
          <FieldRow key={path} label={label} fieldPath={path} value={value} onSave={handleSave} />
        ))}
      </Section>

      {/* ── Skills (comma-separated list) ── */}
      <Section title="Skills">
        <FieldRow
          label="Skills (comma-separated)"
          fieldPath="skills"
          value={Array.isArray(skills) ? skills.join(', ') : skills}
          onSave={(path, val) => handleSave(path, val.split(',').map((s) => s.trim()).filter(Boolean))}
        />
      </Section>

      {/* ── Languages ── */}
      <Section title="Languages">
        <FieldRow
          label="Languages (comma-separated)"
          fieldPath="languages"
          value={Array.isArray(languages) ? languages.join(', ') : languages}
          onSave={(path, val) => handleSave(path, val.split(',').map((s) => s.trim()).filter(Boolean))}
        />
      </Section>

      {/* ── Education (read-only summary, editable via index) ── */}
      <Section title="Education">
        {education.length === 0 ? (
          <p className="empty-list">No education entries.</p>
        ) : (
          education.map((edu, i) => (
            <div key={i} className="list-card">
              <FieldRow label="Institution" fieldPath={`education.${i}.institution`} value={edu.institution} onSave={handleSave} />
              <FieldRow label="Degree" fieldPath={`education.${i}.degree`} value={edu.degree} onSave={handleSave} />
              <FieldRow label="Field" fieldPath={`education.${i}.field`} value={edu.field} onSave={handleSave} />
              <FieldRow label="Start Year" fieldPath={`education.${i}.startYear`} value={edu.startYear} onSave={handleSave} />
              <FieldRow label="End Year" fieldPath={`education.${i}.endYear`} value={edu.endYear} onSave={handleSave} />
              <FieldRow label="GPA" fieldPath={`education.${i}.gpa`} value={edu.gpa} onSave={handleSave} />
            </div>
          ))
        )}
      </Section>

      {/* ── Experience ── */}
      <Section title="Work Experience">
        {experience.length === 0 ? (
          <p className="empty-list">No experience entries.</p>
        ) : (
          experience.map((exp, i) => (
            <div key={i} className="list-card">
              <FieldRow label="Company" fieldPath={`experience.${i}.company`} value={exp.company} onSave={handleSave} />
              <FieldRow label="Title" fieldPath={`experience.${i}.title`} value={exp.title} onSave={handleSave} />
              <FieldRow label="Start Date" fieldPath={`experience.${i}.startDate`} value={exp.startDate} onSave={handleSave} />
              <FieldRow label="End Date" fieldPath={`experience.${i}.endDate`} value={exp.endDate} onSave={handleSave} />
              <FieldRow label="Description" fieldPath={`experience.${i}.description`} value={exp.description} onSave={handleSave} />
            </div>
          ))
        )}
      </Section>

      {/* ── Custom Fields ── */}
      <Section title="Custom Fields">
        {Object.keys(custom).length === 0 && !addingCustom && (
          <p className="empty-list">No custom fields yet. Fields you save from forms appear here.</p>
        )}
        {Object.entries(custom).map(([key, value]) => (
          <FieldRow
            key={key}
            label={key.replace(/_/g, ' ')}
            fieldPath={`custom.${key}`}
            value={value}
            onSave={handleSave}
            onDelete={() => handleDeleteCustom(key)}
            deletable
          />
        ))}
        {addingCustom ? (
          <div className="add-custom-form">
            <input
              placeholder="Field name (e.g. desiredSalary)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="field-input"
            />
            <input
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="field-input"
            />
            <div className="add-custom-actions">
              <button onClick={handleAddCustom} className="btn btn-primary">Add</button>
              <button onClick={() => { setAddingCustom(false); setNewKey(''); setNewValue(''); }} className="btn">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCustom(true)} className="btn btn-add-custom">
            + Add custom field
          </button>
        )}
      </Section>

      {/* ── Meta info ── */}
      <div className="profile-meta">
        <small>
          Source: {profile.meta.sourceFileName || 'Unknown'} ·
          Last updated: {profile.meta.lastUpdated ? new Date(profile.meta.lastUpdated).toLocaleString() : 'Never'}
        </small>
      </div>
    </div>
  );
}
