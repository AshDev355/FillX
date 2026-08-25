/**
 * storage.js — Member 4: Data / QA / Deployment Lead
 * Helper functions for all chrome.storage.local access.
 * Import this module wherever profile data needs to be read or written.
 *
 * Usage (in popup or background):
 *   import { getProfile, setProfile, updateField, ... } from './storage.js';
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  PROFILE: 'profile',
  SETTINGS: 'settings',
  FIELD_CACHE: 'fieldCache',
};

/** Default empty profile — used when no document has been uploaded yet. */
const DEFAULT_PROFILE = {
  meta: {
    lastUpdated: null,
    sourceFileName: null,
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
};

const DEFAULT_SETTINGS = {
  highlightMatched: true,
  highlightAmbiguous: true,
  highlightUnmatched: true,
  autoPromptSave: true,
};

// ─── Core Helpers ─────────────────────────────────────────────────────────────

/**
 * Low-level: read one or more keys from chrome.storage.local.
 * Returns a Promise that resolves to the storage result object.
 */
function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Low-level: write an object of key→value pairs into chrome.storage.local.
 * Returns a Promise that resolves when the write is complete.
 */
function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * Get the full user profile from storage.
 * Returns DEFAULT_PROFILE if nothing has been saved yet.
 *
 * @returns {Promise<object>} The profile object.
 */
export async function getProfile() {
  const result = await storageGet(STORAGE_KEYS.PROFILE);
  return result[STORAGE_KEYS.PROFILE] ?? DEFAULT_PROFILE;
}

/**
 * Overwrite the entire profile with a new object.
 * Automatically stamps meta.lastUpdated.
 *
 * @param {object} profileData - The new profile (should match schema shape).
 * @param {string} [sourceFileName] - Original uploaded filename (optional).
 * @returns {Promise<void>}
 */
export async function setProfile(profileData, sourceFileName = null) {
  const profile = {
    ...DEFAULT_PROFILE,
    ...profileData,
    meta: {
      ...DEFAULT_PROFILE.meta,
      ...(profileData.meta ?? {}),
      lastUpdated: new Date().toISOString(),
      ...(sourceFileName ? { sourceFileName } : {}),
    },
  };
  await storageSet({ [STORAGE_KEYS.PROFILE]: profile });
}

/**
 * Update a single flat field on the profile.
 * Supports dot-notation paths, e.g. "personal.email" or "address.city".
 * For top-level arrays (education, experience, skills) use the dedicated helpers below.
 *
 * @param {string} path - Dot-separated key path, e.g. "personal.email"
 * @param {*} value - The new value.
 * @returns {Promise<void>}
 */
export async function updateField(path, value) {
  const profile = await getProfile();
  const keys = path.split('.');
  let cursor = profile;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] === undefined || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
  profile.meta.lastUpdated = new Date().toISOString();
  await storageSet({ [STORAGE_KEYS.PROFILE]: profile });
}

/**
 * Add or update a field in the `custom` section of the profile.
 * This is used by the "Save this for future forms?" flow.
 *
 * @param {string} key - The custom field key (e.g. "desiredSalary").
 * @param {string} value - The value to save.
 * @returns {Promise<void>}
 */
export async function saveCustomField(key, value) {
  const profile = await getProfile();
  profile.custom = { ...(profile.custom ?? {}), [key]: value };
  profile.meta.lastUpdated = new Date().toISOString();
  await storageSet({ [STORAGE_KEYS.PROFILE]: profile });
}

/**
 * Delete a single field from the profile by dot-notation path.
 * Deleting a nested key sets it to '' (empty string), not undefined,
 * to keep the schema shape intact.
 *
 * @param {string} path - e.g. "personal.phone"
 * @returns {Promise<void>}
 */
export async function deleteField(path) {
  return updateField(path, '');
}

/**
 * Merge AI-extracted JSON into the existing profile without overwriting
 * fields that the user has manually set.
 * Rule: only fill in fields that are currently empty.
 *
 * @param {object} extractedData - JSON returned from /api/extract.
 * @param {string} [sourceFileName] - Uploaded file name.
 * @returns {Promise<void>}
 */
export async function mergeProfile(extractedData, sourceFileName = null) {
  const existing = await getProfile();

  function mergeObjects(target, source) {
    for (const key of Object.keys(source)) {
      if (Array.isArray(source[key])) {
        // For arrays (education, experience, skills), prefer AI data if target is empty
        if (!target[key] || target[key].length === 0) {
          target[key] = source[key];
        }
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        mergeObjects(target[key], source[key]);
      } else {
        // Only fill in if the target field is empty/missing
        if (!target[key]) {
          target[key] = source[key];
        }
      }
    }
  }

  mergeObjects(existing, extractedData);
  await setProfile(existing, sourceFileName ?? existing.meta?.sourceFileName);
}

/**
 * Clear the entire profile (reset to defaults).
 * @returns {Promise<void>}
 */
export async function clearProfile() {
  await storageSet({ [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE });
}

// ─── Field Cache (Save New Fields) ────────────────────────────────────────────

/**
 * Get all cached custom field answers.
 * @returns {Promise<object>} key→value map of saved answers.
 */
export async function getFieldCache() {
  const result = await storageGet(STORAGE_KEYS.FIELD_CACHE);
  return result[STORAGE_KEYS.FIELD_CACHE] ?? {};
}

/**
 * Save a new answer into the field cache.
 * @param {string} fieldKey - Normalized field label used as lookup key.
 * @param {string} value - The user's answer.
 * @returns {Promise<void>}
 */
export async function cacheField(fieldKey, value) {
  const cache = await getFieldCache();
  cache[fieldKey] = value;
  await storageSet({ [STORAGE_KEYS.FIELD_CACHE]: cache });
  // Also save into profile.custom for AI matching next time
  await saveCustomField(fieldKey, value);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Get user settings.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const result = await storageGet(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
}

/**
 * Update one or more settings keys.
 * @param {object} patch - e.g. { highlightMatched: false }
 * @returns {Promise<void>}
 */
export async function updateSettings(patch) {
  const current = await getSettings();
  await storageSet({ [STORAGE_KEYS.SETTINGS]: { ...current, ...patch } });
}

// ─── Debug Helper ─────────────────────────────────────────────────────────────

/**
 * Dump everything in storage to the console (dev use only).
 */
export async function debugDumpStorage() {
  const all = await storageGet(null);
  console.group('chrome.storage.local dump');
  console.log(JSON.stringify(all, null, 2));
  console.groupEnd();
}
