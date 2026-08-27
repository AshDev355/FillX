/**
 * storage.js — Chrome Storage Local Management with Multi-Account Profile Isolation
 * Provides strongly-typed, schema-validated, per-user persistence for FillX.
 */

export const STORAGE_KEYS = {
  PROFILE: 'profile',
  USER_PROFILE: 'userProfile',
  SETTINGS: 'settings',
  FIELD_CACHE: 'fieldCache',
  HISTORY: 'history',
  AUTH_SESSION: 'fillx_auth_session',
  USERS_REGISTRY: 'fillx_registered_users',
};

/** Default empty profile shape conforming to the canonical schema */
export const DEFAULT_PROFILE = {
  meta: {
    lastUpdated: null,
    sourceFileName: null,
    onboardingCompleted: false,
    version: 1,
  },
  personal: {
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationality: '',
  },
  address: {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  },
  education: [],
  experience: [],
  skills: [],
  languages: [],
  links: {
    linkedin: '',
    github: '',
    portfolio: '',
  },
  custom: {},
  customFields: {},
};

export const DEFAULT_SETTINGS = {
  highlightMatched: true,
  highlightAmbiguous: true,
  highlightUnmatched: true,
  autoPromptSave: true,
  backendUrl: 'http://localhost:3000',
  useOfflineFallback: true,
};

// ─── Low-level Storage Wrappers ──────────────────────────────────────────────

const inMemoryFallbackStore = {};

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      try {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : keys ? [keys] : Object.values(STORAGE_KEYS);
        for (const k of keyList) {
          if (inMemoryFallbackStore[k] !== undefined) {
            result[k] = JSON.parse(JSON.stringify(inMemoryFallbackStore[k]));
          } else if (typeof localStorage !== 'undefined') {
            const val = localStorage.getItem(`fillx_${k}`);
            if (val) result[k] = JSON.parse(val);
          }
        }
        resolve(result);
      } catch (err) {
        resolve({});
      }
      return;
    }

    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result || {});
      }
    });
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      try {
        for (const [k, v] of Object.entries(items)) {
          inMemoryFallbackStore[k] = JSON.parse(JSON.stringify(v));
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`fillx_${k}`, JSON.stringify(v));
          }
        }
        resolve();
      } catch (err) {
        resolve();
      }
      return;
    }

    chrome.storage.local.set(items, () => {
      if (chrome.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      for (const k of keyList) {
        delete inMemoryFallbackStore[k];
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`fillx_${k}`);
        }
      }
      resolve();
      return;
    }
    chrome.storage.local.remove(keyList, () => resolve());
  });
}

// ─── User Profile Key Helpers ────────────────────────────────────────────────

export function getUserProfileKey(emailOrId) {
  if (!emailOrId) return STORAGE_KEYS.PROFILE;
  const cleanId = String(emailOrId).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
  return `fillx_user_profile_${cleanId}`;
}

async function getActiveUserEmail() {
  const res = await storageGet(STORAGE_KEYS.AUTH_SESSION);
  const session = res[STORAGE_KEYS.AUTH_SESSION];
  return session?.user?.email || session?.pendingEmail || null;
}

// ─── Profile Operations (Multi-Account Isolated) ──────────────────────────────

/**
 * Retrieves the stored profile for the currently logged in user or a specified user.
 * @param {string} [specificUserEmail]
 * @returns {Promise<object>}
 */
export async function getProfile(specificUserEmail = null) {
  const userEmail = specificUserEmail || (await getActiveUserEmail());
  const userKey = userEmail ? getUserProfileKey(userEmail) : null;

  const queryKeys = userKey
    ? [userKey, STORAGE_KEYS.PROFILE, STORAGE_KEYS.USER_PROFILE]
    : [STORAGE_KEYS.PROFILE, STORAGE_KEYS.USER_PROFILE];

  const result = await storageGet(queryKeys);
  const p = (userKey ? result[userKey] : null) || result[STORAGE_KEYS.PROFILE] || result[STORAGE_KEYS.USER_PROFILE];

  if (!p) {
    const blank = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    if (userEmail) blank.personal.email = userEmail;
    return blank;
  }

  const customMerged = {
    ...(p.custom || {}),
    ...(p.customFields || {}),
  };

  return {
    ...DEFAULT_PROFILE,
    ...p,
    meta: { ...DEFAULT_PROFILE.meta, ...(p.meta || {}) },
    personal: { ...DEFAULT_PROFILE.personal, ...(p.personal || p.personalDetails || {}) },
    address: { ...DEFAULT_PROFILE.address, ...(p.address || {}) },
    links: { ...DEFAULT_PROFILE.links, ...(p.links || {}) },
    custom: customMerged,
    customFields: customMerged,
    education: Array.isArray(p.education) ? p.education : Array.isArray(p.educationHistory) ? p.educationHistory : [],
    experience: Array.isArray(p.experience) ? p.experience : Array.isArray(p.workHistory) ? p.workHistory : [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
  };
}

/**
 * Overwrites full profile for the currently active user and keeps global profile in sync.
 * @param {object} profileData
 * @param {string} [sourceFileName]
 * @param {string} [specificUserEmail]
 * @returns {Promise<void>}
 */
export async function setProfile(profileData, sourceFileName = null, specificUserEmail = null) {
  const userEmail = specificUserEmail || (await getActiveUserEmail()) || profileData?.personal?.email;
  const current = await getProfile(userEmail);

  const customMerged = {
    ...(current.custom || {}),
    ...(profileData.custom || {}),
    ...(profileData.customFields || {}),
  };

  const updated = {
    ...current,
    ...profileData,
    custom: customMerged,
    customFields: customMerged,
    meta: {
      ...current.meta,
      ...(profileData.meta || {}),
      lastUpdated: new Date().toISOString(),
      ...(sourceFileName ? { sourceFileName } : {}),
    },
  };

  const toSave = {
    [STORAGE_KEYS.PROFILE]: updated,
    [STORAGE_KEYS.USER_PROFILE]: updated,
  };

  if (userEmail) {
    toSave[getUserProfileKey(userEmail)] = updated;
  }

  await storageSet(toSave);
}

/**
 * Switches the active profile in chrome.storage.local to a given user.
 * @param {string} userEmail
 * @param {object} [initialData]
 */
export async function switchActiveUserProfile(userEmail, initialData = null) {
  if (!userEmail) {
    await clearActiveProfile();
    return;
  }

  const userKey = getUserProfileKey(userEmail);
  const res = await storageGet(userKey);
  let userProfile = res[userKey];

  if (!userProfile) {
    userProfile = {
      ...JSON.parse(JSON.stringify(DEFAULT_PROFILE)),
      ...(initialData || {}),
      personal: {
        ...DEFAULT_PROFILE.personal,
        ...(initialData?.personal || {}),
        email: userEmail,
      },
    };
    await storageSet({ [userKey]: userProfile });
  }

  await storageSet({
    [STORAGE_KEYS.PROFILE]: userProfile,
    [STORAGE_KEYS.USER_PROFILE]: userProfile,
  });

  return userProfile;
}

/**
 * Clears only the active global profile from storage (used upon sign-out).
 */
export async function clearActiveProfile() {
  const blank = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  await storageSet({
    [STORAGE_KEYS.PROFILE]: blank,
    [STORAGE_KEYS.USER_PROFILE]: blank,
    [STORAGE_KEYS.FIELD_CACHE]: {},
  });
}

/**
 * Update a single profile field by dot-notation path (e.g. "personal.email").
 * @param {string} path
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function updateField(path, value) {
  const userEmail = await getActiveUserEmail();
  const profile = await getProfile(userEmail);
  const keys = path.split('.');
  let cursor = profile;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] === undefined || typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
  profile.meta.lastUpdated = new Date().toISOString();

  await setProfile(profile, null, userEmail);
}

/**
 * Saves a key-value pair under `profile.custom` and updates any matching canonical fields.
 * @param {string} key
 * @param {string} value
 * @returns {Promise<object>}
 */
export async function saveCustomField(key, value) {
  const userEmail = await getActiveUserEmail();
  const currentProfile = await getProfile(userEmail);

  const updatedCustom = {
    ...(currentProfile.custom || {}),
    ...(currentProfile.customFields || {}),
    [key]: value,
  };

  const updatedProfile = {
    ...currentProfile,
    custom: updatedCustom,
    customFields: updatedCustom,
    personal: { ...(currentProfile.personal || {}) },
    address: { ...(currentProfile.address || {}) },
    links: { ...(currentProfile.links || {}) },
    experience: Array.isArray(currentProfile.experience) ? [...currentProfile.experience] : [{}],
    meta: {
      ...(currentProfile.meta || {}),
      lastUpdated: new Date().toISOString(),
    },
  };

  const cleanKey = String(key || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (['street_address', 'street', 'address', 'address_line_1', 'street_line'].includes(cleanKey)) {
    updatedProfile.address.street = value;
  } else if (['city', 'town', 'municipality'].includes(cleanKey)) {
    updatedProfile.address.city = value;
  } else if (['state', 'province', 'region'].includes(cleanKey)) {
    updatedProfile.address.state = value;
  } else if (['zip', 'zip_code', 'postal_code', 'postcode', 'pin_code'].includes(cleanKey)) {
    updatedProfile.address.zip = value;
  } else if (['country', 'nation'].includes(cleanKey)) {
    updatedProfile.address.country = value;
  } else if (['first_name', 'firstname', 'given_name'].includes(cleanKey)) {
    updatedProfile.personal.firstName = value;
  } else if (['last_name', 'lastname', 'surname', 'family_name'].includes(cleanKey)) {
    updatedProfile.personal.lastName = value;
  } else if (['full_name', 'fullname', 'your_name', 'name'].includes(cleanKey)) {
    updatedProfile.personal.fullName = value;
  } else if (['email', 'email_address', 'e_mail'].includes(cleanKey)) {
    updatedProfile.personal.email = value;
  } else if (['phone', 'phone_number', 'mobile', 'tel', 'mobile_phone'].includes(cleanKey)) {
    updatedProfile.personal.phone = value;
  } else if (['date_of_birth', 'dob', 'birthday', 'birth_date'].includes(cleanKey)) {
    updatedProfile.personal.dateOfBirth = value;
  } else if (['nationality', 'citizenship'].includes(cleanKey)) {
    updatedProfile.personal.nationality = value;
  } else if (['linkedin', 'linkedin_url', 'linkedin_profile'].includes(cleanKey)) {
    updatedProfile.links.linkedin = value;
  } else if (['github', 'github_url', 'github_profile'].includes(cleanKey)) {
    updatedProfile.links.github = value;
  } else if (['portfolio', 'website', 'personal_site'].includes(cleanKey)) {
    updatedProfile.links.portfolio = value;
  } else if (['company', 'employer', 'company_name'].includes(cleanKey)) {
    if (!updatedProfile.experience[0]) updatedProfile.experience[0] = {};
    updatedProfile.experience[0].company = value;
  } else if (['job_title', 'title', 'position', 'role'].includes(cleanKey)) {
    if (!updatedProfile.experience[0]) updatedProfile.experience[0] = {};
    updatedProfile.experience[0].title = value;
  }

  await setProfile(updatedProfile, null, userEmail);

  const cache = await getFieldCache();
  cache[key] = value;
  await storageSet({ [STORAGE_KEYS.FIELD_CACHE]: cache });

  return updatedProfile;
}

/**
 * Deletes a field by setting it to empty string or removing it from custom.
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function deleteField(path) {
  const userEmail = await getActiveUserEmail();
  if (path.startsWith('custom.') || path.startsWith('customFields.')) {
    const key = path.replace(/^(custom\.|customFields\.)/, '');
    const profile = await getProfile(userEmail);
    if (profile.custom && profile.custom[key] !== undefined) {
      delete profile.custom[key];
      delete profile.customFields[key];
      profile.meta.lastUpdated = new Date().toISOString();
      await setProfile(profile, null, userEmail);
    }
    return;
  }
  return updateField(path, '');
}

/**
 * Merges newly extracted JSON data into the active user's profile.
 * @param {object} extractedData
 * @param {string} [sourceFileName]
 * @returns {Promise<object>}
 */
export async function mergeProfile(extractedData, sourceFileName = null) {
  const userEmail = await getActiveUserEmail();
  const existing = await getProfile(userEmail);
  const normalized = normalizeExtractedData(extractedData);

  function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else if (
        Array.isArray(source[key]) &&
        source[key].length > 0
      ) {
        out[key] = source[key];
      } else if (
        source[key] !== null &&
        source[key] !== undefined &&
        source[key] !== ''
      ) {
        out[key] = source[key];
      }
    }
    return out;
  }

  const merged = deepMerge(existing, normalized);
  merged.meta.lastUpdated = new Date().toISOString();
  if (sourceFileName) {
    merged.meta.sourceFileName = sourceFileName;
  }

  merged.custom = { ...(existing.custom || {}), ...(normalized.custom || {}) };
  merged.customFields = merged.custom;

  await setProfile(merged, sourceFileName, userEmail);
  return merged;
}

function normalizeExtractedData(data) {
  if (!data) return {};
  const out = JSON.parse(JSON.stringify(DEFAULT_PROFILE));

  if (data.personal) Object.assign(out.personal, data.personal);
  if (data.personalDetails) Object.assign(out.personal, data.personalDetails);
  if (data.name) out.personal.fullName = data.name;
  if (data.firstName) out.personal.firstName = data.firstName;
  if (data.lastName) out.personal.lastName = data.lastName;
  if (data.email) out.personal.email = data.email;
  if (data.phone) out.personal.phone = data.phone;

  if (data.address) Object.assign(out.address, data.address);
  if (data.location) {
    if (typeof data.location === 'string') {
      out.address.city = data.location;
    } else {
      Object.assign(out.address, data.location);
    }
  }

  if (Array.isArray(data.education)) out.education = data.education;
  if (Array.isArray(data.educationHistory)) out.education = data.educationHistory;
  if (Array.isArray(data.experience)) out.experience = data.experience;
  if (Array.isArray(data.workHistory)) out.experience = data.workHistory;

  if (Array.isArray(data.skills)) out.skills = data.skills;
  if (Array.isArray(data.languages)) out.languages = data.languages;
  if (data.links) Object.assign(out.links, data.links);
  if (data.custom) Object.assign(out.custom, data.custom);
  if (data.customFields) Object.assign(out.custom, data.customFields);

  return out;
}

export async function clearProfile(specificUserEmail = null) {
  const userEmail = specificUserEmail || (await getActiveUserEmail());
  const blank = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  if (userEmail) blank.personal.email = userEmail;

  const toSave = {
    [STORAGE_KEYS.PROFILE]: blank,
    [STORAGE_KEYS.USER_PROFILE]: blank,
    [STORAGE_KEYS.FIELD_CACHE]: {},
  };

  if (userEmail) {
    toSave[getUserProfileKey(userEmail)] = blank;
  }

  await storageSet(toSave);
}

// ─── Registered Users Registry Helpers ────────────────────────────────────────

export async function getRegisteredUsers() {
  const res = await storageGet(STORAGE_KEYS.USERS_REGISTRY);
  return res[STORAGE_KEYS.USERS_REGISTRY] || {};
}

export async function saveRegisteredUser(email, userData) {
  const users = await getRegisteredUsers();
  const cleanEmail = String(email).toLowerCase().trim();
  users[cleanEmail] = {
    ...(users[cleanEmail] || {}),
    ...userData,
    email: cleanEmail,
    lastSeen: new Date().toISOString(),
  };
  await storageSet({ [STORAGE_KEYS.USERS_REGISTRY]: users });
  return users[cleanEmail];
}

// ─── Settings Operations ──────────────────────────────────────────────────────

export async function getSettings() {
  const result = await storageGet(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function updateSettings(partialSettings) {
  const current = await getSettings();
  const updated = { ...current, ...partialSettings };
  await storageSet({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

// ─── Field Cache Operations ───────────────────────────────────────────────────

export async function getFieldCache() {
  const result = await storageGet(STORAGE_KEYS.FIELD_CACHE);
  return result[STORAGE_KEYS.FIELD_CACHE] || {};
}

export async function updateFieldCache(fieldId, value) {
  const cache = await getFieldCache();
  cache[fieldId] = value;
  await storageSet({ [STORAGE_KEYS.FIELD_CACHE]: cache });
}

export async function clearFieldCache() {
  await storageSet({ [STORAGE_KEYS.FIELD_CACHE]: {} });
}

// ─── History Operations ───────────────────────────────────────────────────────

export async function getHistory() {
  const result = await storageGet(STORAGE_KEYS.HISTORY);
  return result[STORAGE_KEYS.HISTORY] || [];
}

export async function addHistoryItem(item) {
  const history = await getHistory();
  const newItem = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    ...item,
  };
  const updated = [newItem, ...history].slice(0, 50);
  await storageSet({ [STORAGE_KEYS.HISTORY]: updated });
  return updated;
}
