/**
 * profiles.js — Multi-Profile Management for FillX
 * Full CRUD: create, switch, update, delete, duplicate profiles.
 * Each profile: { id, name, avatar, color, type, createdAt, data: {...} }
 */

const PROFILES_KEY = 'fillx_profiles';
const ACTIVE_PROFILE_KEY = 'fillx_active_profile_id';

export const PROFILE_COLORS = [
  '#6b1a1a', // maroon (default)
  '#1a3a6b', // navy
  '#1a6b3a', // forest green
  '#6b3a1a', // burnt orange
  '#4a1a6b', // purple
  '#1a5a6b', // teal
  '#6b5a1a', // gold
  '#1a1a6b', // deep blue
];

export const PROFILE_AVATARS = ['👤', '💼', '🎓', '🏢', '🌐', '🚀', '🎨', '⚙️'];

export const PROFILE_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'business', label: 'Business' },
  { value: 'academic', label: 'Academic' },
];

function storageGet(keys) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) { resolve({}); return; }
    chrome.storage.local.get(keys, (r) => resolve(r || {}));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) { resolve(); return; }
    chrome.storage.local.set(items, resolve);
  });
}

export async function getAllProfiles() {
  const res = await storageGet([PROFILES_KEY]);
  return res[PROFILES_KEY] || [];
}

export async function getActiveProfileId() {
  const res = await storageGet([ACTIVE_PROFILE_KEY]);
  return res[ACTIVE_PROFILE_KEY] || null;
}

export async function getActiveProfile() {
  const [profiles, activeId] = await Promise.all([getAllProfiles(), getActiveProfileId()]);
  if (!profiles.length) return null;
  return profiles.find((p) => p.id === activeId) || profiles[0];
}

export async function createProfile({ name, avatar, color, type = 'personal', data = null }) {
  const profiles = await getAllProfiles();
  const id = `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newProfile = {
    id,
    name: name.trim(),
    avatar: avatar || PROFILE_AVATARS[0],
    color: color || PROFILE_COLORS[0],
    type,
    createdAt: new Date().toISOString(),
    data: data || {
      personal: { firstName: '', lastName: '', fullName: '', email: '', phone: '', dateOfBirth: '', nationality: '' },
      address: { street: '', city: '', state: '', zip: '', country: '' },
      education: [],
      experience: [],
      skills: [],
      languages: [],
      links: { linkedin: '', github: '', portfolio: '' },
      custom: {},
    },
  };
  const updated = [...profiles, newProfile];
  const activeId = profiles.length === 0 ? id : await getActiveProfileId();
  await storageSet({
    [PROFILES_KEY]: updated,
    [ACTIVE_PROFILE_KEY]: activeId || id,
  });
  // Also sync to main profile storage if this is the active one
  if (!activeId || profiles.length === 0) {
    await _syncActiveToMain(newProfile);
  }
  return newProfile;
}

export async function switchProfile(id) {
  const profiles = await getAllProfiles();
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error('Profile not found');
  await storageSet({ [ACTIVE_PROFILE_KEY]: id });
  await _syncActiveToMain(profile);
  return profile;
}

export async function updateProfile(id, updates) {
  const profiles = await getAllProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Profile not found');
  profiles[idx] = { ...profiles[idx], ...updates, id };
  await storageSet({ [PROFILES_KEY]: profiles });
  const activeId = await getActiveProfileId();
  if (activeId === id) await _syncActiveToMain(profiles[idx]);
  return profiles[idx];
}

export async function updateProfileData(id, data) {
  return updateProfile(id, { data });
}

export async function deleteProfile(id) {
  const profiles = await getAllProfiles();
  if (profiles.length <= 1) throw new Error('Cannot delete the only profile');
  const filtered = profiles.filter((p) => p.id !== id);
  const activeId = await getActiveProfileId();
  const newActiveId = activeId === id ? filtered[0]?.id : activeId;
  await storageSet({ [PROFILES_KEY]: filtered, [ACTIVE_PROFILE_KEY]: newActiveId });
  if (newActiveId && newActiveId !== activeId) {
    const newActive = filtered.find((p) => p.id === newActiveId);
    if (newActive) await _syncActiveToMain(newActive);
  }
  return filtered;
}

export async function duplicateProfile(id) {
  const profiles = await getAllProfiles();
  const source = profiles.find((p) => p.id === id);
  if (!source) throw new Error('Profile not found');
  return createProfile({
    name: `${source.name} (Copy)`,
    avatar: source.avatar,
    color: source.color,
    type: source.type,
    data: JSON.parse(JSON.stringify(source.data || {})),
  });
}

/** Sync the active profile's data into the main storage keys that the rest of the app reads */
async function _syncActiveToMain(profile) {
  const data = profile?.data || {};
  await storageSet({
    profile: data,
    userProfile: data,
  });
}

/** Initialize profiles from existing main profile data (migration helper) */
export async function initProfilesFromExisting(existingProfile, userName) {
  const existing = await getAllProfiles();
  if (existing.length > 0) return existing;
  const name = userName || existingProfile?.personal?.fullName || existingProfile?.personal?.firstName || 'My Profile';
  return createProfile({ name, avatar: '👤', color: PROFILE_COLORS[0], type: 'personal', data: existingProfile });
}
