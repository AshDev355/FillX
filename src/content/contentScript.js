/**
 * contentScript.js — Main Content Script Entry Point & Message Router
 *
 * Coordinates DOM scanning, autofill execution, highlighting, open-ended
 * answer triggers, dynamic mutation observation, and message routing.
 */

import { detectFormFields } from './fieldDetector.js';
import { fieldIdentifier } from './fieldIdentifier.js';
import { executeAutofill } from './autofillEngine.js';
import { fieldState } from './fieldState.js';
import { clearAllHighlights, injectHighlighterStyles } from './highlighter.js';
import { dynamicObserver } from './dynamicObserver.js';
import { attachGenerateAnswerButtons, removeGenerateAnswerButtons } from './openEndedGenerator.js';
import { MESSAGE_TYPES } from '../shared/messageTypes.js';

// Inject styles on load
injectHighlighterStyles();

function isExtensionValid() {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch (e) {
    return false;
  }
}

function safeSendMessage(message, callback) {
  if (!isExtensionValid()) return;
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime?.lastError) {
        // Silently handled: context disconnected
        return;
      }
      if (callback && typeof callback === 'function') {
        callback(response);
      }
    });
  } catch (e) {
    // Context invalidated — ignore silently
  }
}

/**
 * Scans the page and registers open-ended AI generators.
 *
 * @returns {{ fields: Array<object>, stats: object }}
 */
export function handleScanPage() {
  const fields = detectFormFields(document);
  fieldState.setDetectedFields(fields);
  const stats = fieldState.getStats();

  // Attach "✨ Generate answer" triggers to open-ended fields
  attachGenerateAnswerButtons(fields);

  return {
    fields,
    stats,
  };
}

/**
 * Executes autofill with matching results.
 *
 * @param {Array<object>} results
 * @returns {object}
 */
export function handleAutofillPage(results) {
  if (fieldState.detectedFields.length === 0) {
    handleScanPage();
  }

  const outcome = executeAutofill(results);
  return outcome;
}

/**
 * Clears all visual highlights and injected triggers.
 *
 * @returns {object}
 */
export function handleClearHighlights() {
  clearAllHighlights();
  removeGenerateAnswerButtons();
  return {
    success: true,
    stats: fieldState.getStats(),
  };
}

// Start dynamic observer for SPAs / multi-step forms
dynamicObserver.start(() => {
  if (!isExtensionValid()) {
    dynamicObserver.stop();
    return;
  }

  const previousCount = fieldState.detectedFields.length;
  const { fields, stats } = handleScanPage();

  if (fields.length !== previousCount) {
    safeSendMessage({
      type: MESSAGE_TYPES.RESCAN_PAGE,
      payload: { fields, stats },
    });
  }
});

// Runtime message router
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type || !isExtensionValid()) return false;

      switch (message.type) {
        case MESSAGE_TYPES.SCAN_PAGE: {
          const data = handleScanPage();
          sendResponse({ success: true, ...data });
          return false;
        }

        case MESSAGE_TYPES.AUTOFILL_PAGE: {
          const results = message.payload?.results || message.payload || [];
          const outcome = handleAutofillPage(results);
          sendResponse(outcome);
          return false;
        }

        case MESSAGE_TYPES.GET_PAGE_STATUS: {
          const stats = fieldState.getStats();
          sendResponse({
            success: true,
            stats,
            fields: fieldState.detectedFields,
          });
          return false;
        }

        case MESSAGE_TYPES.CLEAR_HIGHLIGHTS: {
          const data = handleClearHighlights();
          sendResponse(data);
          return false;
        }

        case MESSAGE_TYPES.RESCAN_PAGE: {
          fieldIdentifier.clear();
          const data = handleScanPage();
          sendResponse({ success: true, ...data });
          return false;
        }

        default:
          return false;
      }
    });
  } catch (e) {
    // Suppress context errors
  }
}

// Expose API for in-browser test harness & automated verification
if (typeof window !== 'undefined') {
  window.__FILLX_CONTENT_SCRIPT__ = {
    detectFormFields,
    fieldIdentifier,
    executeAutofill,
    fieldState,
    clearAllHighlights,
    handleScanPage,
    handleAutofillPage,
    handleClearHighlights,
  };
}
