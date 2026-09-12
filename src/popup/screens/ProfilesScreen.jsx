/**
 * ProfilesScreen.jsx — Multi-Profile Switcher
 * Create, switch, edit, delete, duplicate profiles.
 * Each profile stores a full identity (personal, work, freelance, etc.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Trash2, Copy, Edit2, X, ChevronRight, User, Briefcase, GraduationCap, Globe } from 'lucide-react';
import {
  getAllProfiles, getActiveProfileId, createProfile,
  switchProfile, deleteProfile, duplicateProfile, updateProfile,
  PROFILE_COLORS, PROFILE_AVATARS, PROFILE_TYPES,
} from '../../utils/profiles.js';

const TYPE_ICONS = { personal: User, work: Briefcase, freelance: Globe, business: Briefcase, academic: GraduationCap };

export default function ProfilesScreen({ onProfileSwitch }) {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: '', avatar: PROFILE_AVATARS[0], color: PROFILE_COLORS[0], type: 'personal' });
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [all, aid] = await Promise.all([getAllProfiles(), getActiveProfileId()]);
    setProfiles(all);
    setActiveId(aid || all[0]?.id || null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSwitch(id) {
    if (id === activeId || switching) return;
    setSwitching(id);
    setError('');
    try {
      await switchProfile(id);
      setActiveId(id);
      onProfileSwitch?.();
    } catch (e) { setError(e.message); }
    finally { setSwitching(null); }
  }

  function openCreate() {
    setDraft({ name: '', avatar: PROFILE_AVATARS[0], color: PROFILE_COLORS[0], type: 'personal' });
    setShowCreate(true);
    setEditingId(null);
    setError('');
  }

  function openEdit(profile) {
    setDraft({ name: profile.name, avatar: profile.avatar, color: profile.color, type: profile.type || 'personal' });
    setEditingId(profile.id);
    setShowCreate(true);
    setError('');
  }

  async function handleSave() {
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateProfile(editingId, { name: draft.name.trim(), avatar: draft.avatar, color: draft.color, type: draft.type });
      } else {
        const p = await createProfile(draft);
        if (profiles.length === 0) { setActiveId(p.id); onProfileSwitch?.(); }
      }
      await load();
      setShowCreate(false);
      setEditingId(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (profiles.length <= 1) { setError('Cannot delete your only profile'); return; }
    if (!confirm('Delete this profile? This cannot be undone.')) return;
    try {
      const remaining = await deleteProfile(id);
      if (id === activeId) { setActiveId(remaining[0]?.id || null); onProfileSwitch?.(); }
      await load();
    } catch (e) { setError(e.message); }
  }

  async function handleDuplicate(id) {
    try {
      await duplicateProfile(id);
      await load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>MULTI-PROFILE</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginTop: 2 }}>Your Identities</div>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--color-primary)', color: '#fff', border: 'none',
          borderRadius: 10, padding: '7px 12px', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.4px',
        }}>
          <Plus size={13} /> New
        </button>
      </div>

      {/* Active profile banner */}
      {activeId && profiles.length > 0 && (() => {
        const active = profiles.find(p => p.id === activeId);
        if (!active) return null;
        return (
          <div style={{
            background: 'var(--color-secondary-pale)', border: `1.5px solid ${active.color}`,
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: active.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>{active.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</div>
              <div style={{ fontSize: 10, color: active.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ✓ Active · {PROFILE_TYPES.find(t => t.value === (active.type || 'personal'))?.label || 'Personal'}
              </div>
            </div>
          </div>
        );
      })()}

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 11, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showCreate && (
        <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {editingId ? 'Edit Profile' : 'New Profile'}
            </span>
            <button onClick={() => { setShowCreate(false); setEditingId(null); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
              <X size={15} />
            </button>
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 5, letterSpacing: '0.5px' }}>Profile Name</div>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. John · Work, Freelance, Personal"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, background: 'var(--color-surface-inset)', color: 'var(--color-text-primary)', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Type */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 5, letterSpacing: '0.5px' }}>Type</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {PROFILE_TYPES.map(t => (
                <button key={t.value} onClick={() => setDraft(d => ({ ...d, type: t.value }))}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    border: `1.5px solid ${draft.type === t.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: draft.type === t.value ? 'var(--color-secondary-pale)' : 'transparent',
                    color: draft.type === t.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Avatar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 5, letterSpacing: '0.5px' }}>Avatar</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PROFILE_AVATARS.map(av => (
                <button key={av} onClick={() => setDraft(d => ({ ...d, avatar: av }))}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', fontSize: 16,
                    border: `2px solid ${draft.avatar === av ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: draft.avatar === av ? 'var(--color-secondary-pale)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 5, letterSpacing: '0.5px' }}>Color</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {PROFILE_COLORS.map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: `2.5px solid ${draft.color === c ? '#fff' : 'transparent'}`,
                    boxShadow: draft.color === c ? `0 0 0 2px ${c}` : 'none',
                  }} />
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{
              width: '100%', padding: '10px', background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>
            {saving ? '⏳ Saving…' : editingId ? '✓ Update Profile' : '✓ Create Profile'}
          </button>
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No profiles yet</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Create your first profile to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.map(profile => {
            const isActive = profile.id === activeId;
            const isSwitching = switching === profile.id;
            const TypeIcon = TYPE_ICONS[profile.type || 'personal'] || User;
            return (
              <div key={profile.id} style={{
                background: 'var(--color-surface-card)',
                border: `1.5px solid ${isActive ? profile.color : 'var(--color-border)'}`,
                borderRadius: 12, overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {/* Main row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: profile.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0, opacity: isActive ? 1 : 0.8,
                  }}>{profile.avatar}</div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile.name}
                      </span>
                      {isActive && (
                        <span style={{
                          background: profile.color, color: '#fff', fontSize: 8, fontWeight: 800,
                          padding: '1px 6px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0,
                        }}>Active</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <TypeIcon size={9} color="var(--color-text-muted)" />
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {PROFILE_TYPES.find(t => t.value === (profile.type || 'personal'))?.label || 'Personal'}
                      </span>
                      {profile.data?.personal?.email && (
                        <>
                          <span style={{ color: 'var(--color-border)', fontSize: 10 }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                            {profile.data.personal.email}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {!isActive && (
                      <button onClick={() => handleSwitch(profile.id)} disabled={!!switching}
                        style={{
                          padding: '5px 10px', background: 'var(--color-secondary-pale)',
                          border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          color: 'var(--color-primary)', cursor: 'pointer',
                          opacity: isSwitching ? 0.6 : 1,
                        }}>
                        {isSwitching ? '…' : 'Use'}
                      </button>
                    )}
                    <button onClick={() => openEdit(profile)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4 }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDuplicate(profile.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4 }}>
                      <Copy size={13} />
                    </button>
                    {!isActive && (
                      <button onClick={() => handleDelete(profile.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile data summary strip */}
                {profile.data && (
                  <div style={{ padding: '6px 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {profile.data.personal?.fullName && <Chip>{profile.data.personal.fullName}</Chip>}
                    {profile.data.experience?.[0]?.title && <Chip>{profile.data.experience[0].title}</Chip>}
                    {profile.data.experience?.[0]?.company && <Chip>@ {profile.data.experience[0].company}</Chip>}
                    {profile.data.skills?.slice(0, 3).map(s => <Chip key={s}>{s}</Chip>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 4 }}>
        {profiles.length} profile{profiles.length !== 1 ? 's' : ''} · Switch anytime to fill forms with a different identity
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: '2px 7px',
      background: 'var(--color-surface-inset)', border: '1px solid var(--color-border)',
      borderRadius: 20, color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}
