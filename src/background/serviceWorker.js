/**
 * serviceWorker.js — Manifest V3 Background Service Worker
 *
 * Responsibilities:
 * - Relays requests between Popup UI, Content Script, and Backend APIs
 * - Retrieves and updates user profile in chrome.storage.local
 * - Matches form fields via /api/match or local heuristic matcher
 * - Forwards matching results to active tab for autofill
 * - Handles GENERATE_ANSWER requests for keyword-to-answer generation
 * - Handles EXTRACT_DOCUMENT requests for parsing documents into profile JSON
 * - Updates extension toolbar badge with count of fields needing attention
 * - Handles SAVE_CUSTOM_FIELD events from content script
 */

import { MESSAGE_TYPES } from '../shared/messageTypes.js';
import { getProfile, saveCustomField, mergeProfile, getSettings, addHistoryItem } from '../utils/storage.js';
import { matchFieldsWithHeuristics } from '../utils/matchingHeuristics.js';
import { extractProfileFromDocument } from '../utils/documentParser.js';

/**
 * Updates extension action badge count for fields needing attention.
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
    // Suppress errors when tab may be closed
  }
}

/**
 * Calls backend /api/match or falls back to local heuristic matcher.
 *
 * @param {Array<object>} fields
 * @param {object} profile
 * @returns {Promise<Array<object>>}
 */
async function performMatch(fields, profile) {
  const settings = await getSettings();
  const backendUrl = settings.backendUrl || 'http://localhost:3000';

  try {
    const response = await fetch(`${backendUrl}/api/match`, {
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
  } catch (err) {
    // Backend offline / not running
  }

  // Graceful local heuristic matching fallback
  return matchFieldsWithHeuristics(fields, profile);
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
  const settings = await getSettings();
  const backendUrl = settings.backendUrl || 'http://localhost:3000';

  try {
    const response = await fetch(`${backendUrl}/api/generate`, {
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
    // Backend offline
  }

  // Local fallback synthesizer
  const p = profile || {};
  const exp = Array.isArray(p.experience) && p.experience[0];
  const role = exp?.title || 'Software Professional';
  const comp = exp?.company || 'my recent experience';

  return `Throughout my career as a ${role} at ${comp}, I have developed deep expertise in ${keywords}. When addressing "${question}", I leverage these core competencies to deliver consistent, high-impact results. I look forward to applying my problem-solving skills and technical background to contribute effectively to your team.`;
}

function isScriptableUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
}

function safeSendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function broadcastRuntimeMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  try {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime?.lastError) {
        // Handled silently: popup view is closed, which is standard behavior
      }
    });
  } catch (e) {
    // Suppress context errors
  }
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
            const profile = message.payload?.profile || (await getProfile());
            const results = await performMatch(fields, profile);
            sendResponse({ success: true, results });
            break;
          }

          case MESSAGE_TYPES.AUTOFILL_PAGE: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id || !isScriptableUrl(tab.url)) {
              sendResponse({ success: false, error: 'Cannot autofill on browser system pages. Open a web form tab.' });
              return;
            }

            let fields = message.payload?.fields;
            if (!fields) {
              const scanRes = await safeSendTabMessage(tab.id, { type: MESSAGE_TYPES.SCAN_PAGE });
              fields = scanRes?.fields || [];
            }

            const profile = message.payload?.profile || (await getProfile());
            const results = await performMatch(fields, profile);

            const fillRes = await safeSendTabMessage(tab.id, {
              type: MESSAGE_TYPES.AUTOFILL_PAGE,
              payload: { results },
            });

            if (fillRes?.stats?.fieldsNeedAttention !== undefined) {
              await updateBadge(fillRes.stats.fieldsNeedAttention, tab.id);
            }

            // Record in history
            await addHistoryItem({
              type: 'FORM',
              title: tab.title ? tab.title.slice(0, 30) : 'Autofilled Form',
              meta: `Filled ${fillRes?.filledCount || 0} fields`,
              status: 'COMPLETED',
            });

            sendResponse({
              success: true,
              results,
              fillOutcome: fillRes,
            });
            break;
          }

          case MESSAGE_TYPES.GENERATE_ANSWER: {
            const { question, keywords } = message.payload || {};
            const profile = await getProfile();
            const answer = await performGenerateAnswer(question, keywords, profile);
            sendResponse({ success: true, answer });
            break;
          }

          case MESSAGE_TYPES.EXTRACT_DOCUMENT: {
            try {
              const { documentText, fileName } = message.payload || {};
              const settings = await getSettings();
              const extracted = await extractProfileFromDocument(documentText, settings?.backendUrl);
              await mergeProfile(extracted, fileName);

              await addHistoryItem({
                type: 'DOCUMENT',
                title: fileName || 'Uploaded Document',
                meta: `Extracted ${new Date().toLocaleDateString()}`,
                status: 'READY',
              });

              sendResponse({ success: true, profile: extracted });
            } catch (extErr) {
              console.error('FillX Background: Document extraction fallback notice:', extErr);
              const fallbackProfile = await getProfile();
              sendResponse({ success: true, profile: fallbackProfile });
            }
            break;
          }

          case 'SAVE_UNMATCHED_FIELD':
          case MESSAGE_TYPES.SAVE_UNMATCHED_FIELD:
          case MESSAGE_TYPES.SAVE_CUSTOM_FIELD: {
            const fieldKey = message.fieldKey || message.payload?.fieldKey || message.payload?.key || message.key;
            const fieldValue = message.fieldValue || message.payload?.fieldValue || message.payload?.value || message.value;

            if (fieldKey && fieldValue !== undefined) {
              const updatedProfile = await saveCustomField(fieldKey, fieldValue);

              // Broadcast storage update to active popup if open
              broadcastRuntimeMessage({
                action: 'PROFILE_UPDATED',
                type: MESSAGE_TYPES.PROFILE_UPDATED,
                updatedProfile,
              });

              sendResponse({
                status: 'success',
                success: true,
                profile: updatedProfile,
                updatedProfile,
              });
            } else {
              sendResponse({ status: 'error', success: false, error: 'Missing fieldKey or fieldValue' });
            }
            break;
          }

          case MESSAGE_TYPES.GET_PAGE_STATUS: {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id || !isScriptableUrl(tab.url)) {
              sendResponse({ success: false, error: 'Unscriptable tab' });
              return;
            }
            const statusRes = await safeSendTabMessage(tab.id, { type: MESSAGE_TYPES.GET_PAGE_STATUS });
            sendResponse(statusRes || { stats: null });
            break;
          }

          default:
            sendResponse({ success: false, error: `Unhandled message type: ${message.type}` });
            break;
        }
      } catch (err) {
        console.error('FillX Background: Message handling error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keeps channel open for async response
  });
}
