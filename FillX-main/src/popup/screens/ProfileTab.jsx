/**
 * ProfileTab.jsx — Interactive Profile Management Screen
 *
 * Allows viewing, editing, adding, and deleting profile fields and custom answers.
 * Automatically synchronizes changes to chrome.storage.local via storage.js.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, X, User, MapPin, Link2, Code, BookOpen, Briefcase, Sparkles } from 'lucide-react';
import { getProfile, updateField, saveCustomField, deleteField } from '../../utils/storage.js';

function FieldRow({ label, fieldPath, value, onSave, onDelete, deletable = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  function handleSave() {
    onSave(fieldPath, draft);
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setDraft(value || '');
      setEditing(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: '1px solid var(--color-border)',
      gap: 8,
    }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 100, flexShrink: 0, fontWeight: 500 }}>
        {label}
      </span>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <input
            autoFocus
            style={{
              padding: '4px 8px',
              fontSize: 12,
              flex: 1,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-primary)',
              borderRadius: 6,
              outline: 'none',
              color: 'var(--color-text-primary)',
            }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSave}
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => {
              setDraft(value || '');
              setEditing(false);
            }}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              color: 'var(--color-text-muted)',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 12,
            color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            textAlign: 'right',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            {value || '—'}
          </span>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
            title="Edit"
          >
            <Edit2 size={12} />
          </button>
          {deletable && (
            <button
              onClick={() => onDelete(fieldPath)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 8,
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && (
            <span style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--color-secondary-pale)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}>
              <Icon size={12} />
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700 }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
      </button>

      {open && (
        <div style={{ padding: '0 14px 10px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProfileTab({ onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const loadProfile = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();

    const handleStorageChange = (changes, area) => {
      if (area === 'local' && (changes.profile || changes.userProfile)) {
        loadProfile();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [loadProfile]);

  const triggerToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1500);
  };

  const handleSaveField = async (path, value) => {
    await updateField(path, value);
    await loadProfile();
    if (onProfileUpdated) onProfileUpdated();
    triggerToast();
  };

  const handleDeleteCustom = async (key) => {
    await deleteField(`custom.${key}`);
    await loadProfile();
    if (onProfileUpdated) onProfileUpdated();
    triggerToast();
  };

  const handleAddCustom = async () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    await saveCustomField(key, newValue.trim());
    setNewKey('');
    setNewValue('');
    setAddingCustom(false);
    await loadProfile();
    if (onProfileUpdated) onProfileUpdated();
    triggerToast();
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading profile...
      </div>
    );
  }

  const personal = profile?.personal || {};
  const address = profile?.address || {};
  const links = profile?.links || {};
  const custom = profile?.custom || {};
  const education = Array.isArray(profile?.education) && profile.education[0] ? profile.education[0] : {};
  const experience = Array.isArray(profile?.experience) && profile.experience[0] ? profile.experience[0] : {};
  const skillsStr = Array.isArray(profile?.skills) ? profile.skills.join(', ') : '';

  return (
    <div className="profile-tab" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <p className="eyebrow-text">PROFILE DATA</p>
          <h1 className="font-display" style={{ fontSize: 20 }}>Your Information</h1>
        </div>
        {saveToast && (
          <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Saved!</span>
        )}
      </div>

      {/* Personal Info */}
      <Section title="Personal Information" icon={User} defaultOpen={true}>
        <FieldRow label="First Name" fieldPath="personal.firstName" value={personal.firstName} onSave={handleSaveField} />
        <FieldRow label="Last Name" fieldPath="personal.lastName" value={personal.lastName} onSave={handleSaveField} />
        <FieldRow label="Full Name" fieldPath="personal.fullName" value={personal.fullName} onSave={handleSaveField} />
        <FieldRow label="Email" fieldPath="personal.email" value={personal.email} onSave={handleSaveField} />
        <FieldRow label="Phone" fieldPath="personal.phone" value={personal.phone} onSave={handleSaveField} />
        <FieldRow label="Date of Birth" fieldPath="personal.dateOfBirth" value={personal.dateOfBirth} onSave={handleSaveField} />
        <FieldRow label="Nationality" fieldPath="personal.nationality" value={personal.nationality} onSave={handleSaveField} />
      </Section>

      {/* Address */}
      <Section title="Address" icon={MapPin}>
        <FieldRow label="Street" fieldPath="address.street" value={address.street} onSave={handleSaveField} />
        <FieldRow label="City" fieldPath="address.city" value={address.city} onSave={handleSaveField} />
        <FieldRow label="State / Province" fieldPath="address.state" value={address.state} onSave={handleSaveField} />
        <FieldRow label="Postal / ZIP" fieldPath="address.zip" value={address.zip} onSave={handleSaveField} />
        <FieldRow label="Country" fieldPath="address.country" value={address.country} onSave={handleSaveField} />
      </Section>

      {/* Work Experience */}
      <Section title="Recent Experience" icon={Briefcase}>
        <FieldRow label="Company" fieldPath="experience.0.company" value={experience.company} onSave={handleSaveField} />
        <FieldRow label="Job Title" fieldPath="experience.0.title" value={experience.title} onSave={handleSaveField} />
      </Section>

      {/* Education */}
      <Section title="Education" icon={BookOpen}>
        <FieldRow label="Institution" fieldPath="education.0.institution" value={education.institution} onSave={handleSaveField} />
        <FieldRow label="Degree" fieldPath="education.0.degree" value={education.degree} onSave={handleSaveField} />
      </Section>

      {/* Skills */}
      <Section title="Skills & Keywords" icon={Code}>
        <FieldRow
          label="Skills (Comma-separated)"
          fieldPath="skills"
          value={skillsStr}
          onSave={async (path, val) => {
            const arr = val.split(',').map((s) => s.trim()).filter(Boolean);
            await updateField('skills', arr);
            await loadProfile();
            if (onProfileUpdated) onProfileUpdated();
            triggerToast();
          }}
        />
      </Section>

      {/* Links */}
      <Section title="Online Profiles & Links" icon={Link2}>
        <FieldRow label="LinkedIn" fieldPath="links.linkedin" value={links.linkedin} onSave={handleSaveField} />
        <FieldRow label="GitHub" fieldPath="links.github" value={links.github} onSave={handleSaveField} />
        <FieldRow label="Portfolio" fieldPath="links.portfolio" value={links.portfolio} onSave={handleSaveField} />
      </Section>

      {/* Custom Fields */}
      <div className="card-surface" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="var(--color-primary)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>Custom / Saved Fields</span>
          </div>
          <button
            onClick={() => setAddingCustom(!addingCustom)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={13} />
            <span>Add Field</span>
          </button>
        </div>

        {addingCustom && (
          <div style={{
            padding: 10,
            background: 'var(--color-surface-inset)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                placeholder="Field name (e.g. Salary)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              />
              <input
                placeholder="Value (e.g. $120k)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{ flex: 1, fontSize: 11 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAddingCustom(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                style={{
                  background: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {Object.keys(custom).length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
            No custom fields yet. Fields saved from web pages will appear here.
          </div>
        ) : (
          Object.entries(custom).map(([key, val]) => (
            <FieldRow
              key={key}
              label={key.replace(/_/g, ' ')}
              fieldPath={`custom.${key}`}
              value={val}
              onSave={(path, newVal) => handleSaveField(path, newVal)}
              onDelete={() => handleDeleteCustom(key)}
              deletable={true}
            />
          ))
        )}
      </div>
    </div>
  );
}
