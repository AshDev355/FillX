/**
 * contentScript.js — Main Content Script Entry Point & Message Router
 *
 * Coordinates webpage form field detection, autofill execution, highlighting,
 * dynamic mutation observation, and communication with the background worker / popup.
 */

import { detectFormFields } from './fieldDetector.js';
import { fieldIdentifier } from './fieldIdentifier.js';
import { executeAutofill } from './autofillEngine.js';
import { fieldState } from './fieldState.js';
import { clearAllHighlights, injectHighlighterStyles } from './highlighter.js';
import { dynamicObserver } from './dynamicObserver.js';
import { MESSAGE_TYPES } from '../shared/messageTypes.js';

// Initialize styles immediately on content script load
injectHighlighterStyles();

/**
 * Performs a complete scan of the current page and updates internal state.
 *
 * @returns {object} { fields, stats }
 */
export function handleScanPage() {
  const fields = detectFormFields(document);
  fieldState.setDetectedFields(fields);
  const stats = fieldState.getStats();

  return {
    fields,
    stats,
  };
}

/**
 * Handles the autofill action with matching results from AI / backend.
 *
 * @param {Array<object>} results
 * @returns {object} { success, filledCount, stats }
 */
export function handleAutofillPage(results) {
  // If no scan has been performed yet, scan now
  if (fieldState.detectedFields.length === 0) {
    handleScanPage();
  }

  const outcome = executeAutofill(results);
  return outcome;
}

/**
 * Handles clearing all highlights on the page.
 *
 * @returns {object} { success, stats }
 */
export function handleClearHighlights() {
  clearAllHighlights();
  return {
    success: true,
    stats: fieldState.getStats(),
  };
}

// Start watching for dynamic DOM insertions (multi-step forms, SPAs)
dynamicObserver.start(() => {
  const previousCount = fieldState.detectedFields.length;
  const { fields, stats } = handleScanPage();

  if (fields.length !== previousCount) {
    // Notify background / popup that fields have changed
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RESCAN_PAGE,
        payload: { fields, stats },
      }).catch(() => {
        // Suppress errors if popup is closed
      });
    }
  }
});

// Setup runtime message listener for commands from Popup or Background
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

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
}

// Expose debug API on window for local test harness & automated tests
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
