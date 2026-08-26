/**
 * serviceWorker.js — Manifest V3 Background Service Worker
 *
 * Responsibilities:
 * - Relays requests between Popup UI, Content Script, and Backend (/api/match & /api/generate)
 * - Retrieves user profile from chrome.storage.local
 * - Forwards matching results to active tab for autofill
 * - Handles GENERATE_ANSWER requests for Phase 9 keyword-to-answer generator
 * - Provides offline test adapter fallback when backend is unavailable
 * - Updates extension action badge count for fields needing attention
 * - Handles SAVE_CUSTOM_FIELD events from content script to chrome.storage.local
 */

import { MESSAGE_TYPES, MATCH_STATUS } from '../shared/messageTypes.js';

const BACKEND_MATCH_URL = 'http://localhost:3000/api/match';
const BACKEND_GENERATE_URL = 'http://localhost:3000/api/generate';

/**
 * Retrieves the stored profile from chrome.storage.local.
 *
 * @returns {Promise<object>}
 */
async function getStoredProfile() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }
  const result = await chrome.storage.local.get(['profile']);
  return result.profile || null;
}

/**
 * Updates the extension toolbar badge with the attention count.
 *
 * @param {number} attentionCount
 * @param {number} [tabId]
 */
async function updateBadge(attentionCount, tabId = null) {
  if (typeof chrome === 'undefined' || !chrome.action?.setBadgeText) return;

  const text = attentionCount > 0 ? String(attentionCount) : '';
  const color = attentionCount > 0 ? '#f59e0b' : '#10b981';

  try {
    const badgeOptions = tabId ? { text, tabId } : { text };
    const colorOptions = tabId ? { color, tabId } : { color };

    await chrome.action.setBadgeText(badgeOptions);
    await chrome.action.setBadgeBackgroundColor(colorOptions);
  } catch (err) {
    // Suppress badge errors in contexts where tab may have closed
  }
}

/**
 * Local heuristic matching adapter used when backend is offline or in test mode.
 *
 * @param {Array<object>} fields
 * @param {object} profile
 * @returns {Array<object>}
 */
export function generateLocalMockMatches(fields, profile) {
  if (!Array.isArray(fields)) return [];

  const p = profile || {};
  const personal = p.personal || p;
  const address = p.address || {};
  const custom = p.custom || {};

  const results = [];

  for (const field of fields) {
    const clues = [
      field.name,
      field.id,
      field.label,
      field.placeholder,
      field.ariaLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let status = MATCH_STATUS.NO_MATCH;
    let value = null;
    let confidence = 0;
    let isOpenEnded = false;

    // Detect open-ended / textarea fields
    if (field.tagName === 'TEXTAREA' || clues.includes('why') || clues.includes('describe') || clues.includes('cover letter')) {
      isOpenEnded = true;
    }

    // Name matching
    if (clues.includes('first name') || clues.includes('fname') || clues.includes('given name')) {
      value = personal.firstName || (personal.name ? personal.name.split(' ')[0] : null) || personal.fullName?.split(' ')[0];
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.95;
    } else if (clues.includes('last name') || clues.includes('lname') || clues.includes('surname') || clues.includes('family name')) {
      value = personal.lastName || (personal.name ? personal.name.split(' ').slice(1).join(' ') : null) || personal.fullName?.split(' ').slice(1).join(' ');
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.95;
    } else if (clues.includes('name') && !clues.includes('company') && !clues.includes('school') && !clues.includes('username')) {
      value = personal.fullName || personal.name || `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.92;
    }
    // Email matching
    else if (field.type === 'email' || clues.includes('email') || clues.includes('e-mail')) {
      value = personal.email || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.98;
    }
    // Phone matching
    else if (field.type === 'tel' || clues.includes('phone') || clues.includes('mobile') || clues.includes('telephone')) {
      value = personal.phone || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.95;
    }
    // Address matching
    else if (clues.includes('street') || clues.includes('address line 1') || (clues.includes('address') && !clues.includes('email'))) {
      value = address.street || personal.address || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.90;
    } else if (clues.includes('city') || clues.includes('town')) {
      value = address.city || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.92;
    } else if (clues.includes('state') || clues.includes('province') || clues.includes('region')) {
      value = address.state || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.88;
    } else if (clues.includes('zip') || clues.includes('postal') || clues.includes('postcode')) {
      value = address.zip || address.postalCode || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.92;
    } else if (clues.includes('country')) {
      value = address.country || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.90;
    }
    // Date of birth
    else if (clues.includes('birth') || clues.includes('dob')) {
      value = personal.dateOfBirth || null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.90;
    }
    // Education / School
    else if (clues.includes('school') || clues.includes('university') || clues.includes('college')) {
      const edu = Array.isArray(p.education) && p.education[0];
      value = edu ? (edu.school || edu.institution) : null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.85;
    } else if (clues.includes('degree') || clues.includes('major')) {
      const edu = Array.isArray(p.education) && p.education[0];
      value = edu ? edu.degree : null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.85;
    }
    // Company / Experience
    else if (clues.includes('company') || clues.includes('employer') || clues.includes('organization')) {
      const exp = Array.isArray(p.experience) && p.experience[0];
      value = exp ? exp.company : null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.85;
    } else if (clues.includes('job title') || clues.includes('position') || clues.includes('role')) {
      const exp = Array.isArray(p.experience) && p.experience[0];
      value = exp ? exp.title : null;
      status = value ? MATCH_STATUS.MATCHED : MATCH_STATUS.NO_MATCH;
      confidence = 0.85;
    }
    // Custom fields from cache / profile.custom
    else {
      for (const [k, v] of Object.entries(custom)) {
        if (clues.includes(k.replace(/_/g, ' '))) {
          value = v;
          status = MATCH_STATUS.MATCHED;
          confidence = 0.88;
          break;
        }
      }
    }

    if (clues.includes('preferred') || clues.includes('alternate') || clues.includes('additional') || clues.includes('optional note')) {
      if (value) {
        status = MATCH_STATUS.AMBIGUOUS;
        confidence = 0.65;
      }
    }

    results.push({
      fieldId: field.fieldId,
      status: value ? status : MATCH_STATUS.NO_MATCH,
      value: value || null,
      confidence: confidence || (value ? 0.8 : 0),
      isOpenEnded,
    });
  }

  return results;
}

/**
 * Calls backend /api/match or falls back to local matcher if server is unreachable.
 *
 * @param {Array<object>} fields
 * @param {object} profile
 * @returns {Promise<Array<object>>}
 */
async function performMatch(fields, profile) {
  try {
    const response = await fetch(BACKEND_MATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, profile }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
    }
    console.warn(`FillX Background: Backend returned status ${response.status}. Using local mock matcher.`);
  } catch (err) {
    console.info('FillX Background: Backend /api/match unavailable (offline/dev). Using local mock matcher.');
  }

  return generateLocalMockMatches(fields, profile);
}

/**
 * Calls backend /api/generate for open-ended keyword-to-answer generation.
 *
 * @param {string} question
 * @param {string} keywords
 * @param {object} profile
 * @returns {Promise<string>}
 */
async function performGenerateAnswer(question, keywords, profile) {
  try {
    const response = await fetch(BACKEND_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, keywords, profile }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.answer) {
        return data.answer;
      }
    }
  } catch (err) {
    console.info('FillX Background: Backend /api/generate unavailable. Using local synthesizer.');
  }

  // Fallback local answer synthesizer
  const p = profile || {};
  const exp = Array.isArray(p.experience) && p.experience[0];
  const role = exp?.title || 'Software Professional';
  const comp = exp?.company || 'my recent role';

  return `Throughout my career as a ${role} at ${comp}, I have developed deep expertise in ${keywords}. When addressing "${question}", I leverage these core competencies to deliver consistent, high-impact results. I look forward to applying my problem-solving skills and technical background to contribute effectively to your team.`;
}

// ─── Runtime Message Router ──────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

    (async () => {
      try {
        switch (message.type) {
          case MESSAGE_TYPES.MATCH_FIELDS: {
            const fields = message.payload?.fields || [];
            let profile = message.payload?.profile || await getStoredProfile();

            const results = await performMatch(fields, profile);
            sendResponse({ success: true, results });
            break;
          }

          case MESSAGE_TYPES.AUTOFILL_PAGE: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
              sendResponse({ success: false, error: 'No active tab found.' });
              return;
            }

            let fields = message.payload?.fields;
            if (!fields) {
              const scanRes = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.SCAN_PAGE });
              fields = scanRes?.fields || [];
            }

            let profile = message.payload?.profile || await getStoredProfile();
            const results = await performMatch(fields, profile);

            const fillRes = await chrome.tabs.sendMessage(tab.id, {
              type: MESSAGE_TYPES.AUTOFILL_PAGE,
              payload: { results },
            });

            if (fillRes?.stats?.fieldsNeedAttention !== undefined) {
              await updateBadge(fillRes.stats.fieldsNeedAttention, tab.id);
            }

            sendResponse({
              success: true,
              results,
              fillOutcome: fillRes,
            });
            break;
          }

          case MESSAGE_TYPES.GENERATE_ANSWER: {
            const { question, keywords } = message.payload || {};
            const profile = await getStoredProfile();
            const answer = await performGenerateAnswer(question, keywords, profile);
            sendResponse({ success: true, answer });
            break;
          }

          case MESSAGE_TYPES.SAVE_CUSTOM_FIELD: {
            const { key, value } = message.payload || {};
            if (key && value && chrome.storage?.local) {
              const data = await chrome.storage.local.get(['profile', 'fieldCache']);
              const profile = data.profile || {};
              profile.custom = { ...(profile.custom || {}), [key]: value };

              const fieldCache = data.fieldCache || {};
              fieldCache[key] = value;

              await chrome.storage.local.set({ profile, fieldCache });
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Missing key or value' });
            }
            break;
          }

          case MESSAGE_TYPES.GET_PAGE_STATUS: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }
            const statusRes = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_PAGE_STATUS });
            sendResponse(statusRes);
            break;
          }

          default:
            sendResponse({ success: false, error: `Unhandled message type: ${message.type}` });
            break;
        }
      } catch (err) {
        console.error('FillX Background: Error handling message:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  });
}
