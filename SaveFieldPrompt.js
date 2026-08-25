/**
 * SaveFieldPrompt.js — Member 4: Data / QA / Deployment Lead
 *
 * Content-script-side logic for the "Save this for future forms?" flow.
 * This runs inside the webpage (content script context).
 *
 * When the user manually fills a field that was flagged as unmatched,
 * we detect the blur event and show a small prompt asking if they want
 * to save the value to their profile.
 *
 * Member 1 calls `attachSavePrompts(unmatchedFields)` after autofill.
 * This module handles the rest.
 *
 * Dependencies: none (runs as vanilla JS in the content script)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_CLASS = 'autofill-save-prompt';
const SAVED_ATTR = 'data-autofill-saved';

// ─── Inject Prompt Styles (once) ─────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('autofill-save-styles')) return;
  const style = document.createElement('style');
  style.id = 'autofill-save-styles';
  style.textContent = `
    .${PROMPT_CLASS} {
      position: absolute;
      z-index: 999999;
      background: #1a1a2e;
      color: #e0e0e0;
      border: 1px solid #4a4aff;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: all;
      white-space: nowrap;
    }
    .${PROMPT_CLASS} button {
      border: none;
      border-radius: 4px;
      padding: 3px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .${PROMPT_CLASS} .save-yes {
      background: #4a4aff;
      color: white;
    }
    .${PROMPT_CLASS} .save-no {
      background: transparent;
      color: #aaa;
      border: 1px solid #555 !important;
    }
    .${PROMPT_CLASS} .save-yes:hover { background: #3a3ae0; }
    .${PROMPT_CLASS} .save-no:hover { color: #fff; }
  `;
  document.head.appendChild(style);
}

// ─── Prompt Rendering ─────────────────────────────────────────────────────────

/**
 * Show the "Save this for future forms?" prompt near the given input element.
 * @param {HTMLElement} inputEl - The input that was just filled.
 * @param {string} fieldLabel - Human-readable label for the field.
 * @param {string} value - The value the user typed.
 * @param {function} onSave - Called with (fieldLabel, value) when user clicks "Yes".
 */
function showSavePrompt(inputEl, fieldLabel, value, onSave) {
  // Remove any existing prompt first
  removeSavePrompt();

  const prompt = document.createElement('div');
  prompt.className = PROMPT_CLASS;
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Save field to profile?');

  prompt.innerHTML = `
    <span>💾 Save "<strong>${escapeHtml(fieldLabel)}</strong>" to your profile?</span>
    <button class="save-yes">Yes, save it</button>
    <button class="save-no">No thanks</button>
  `;

  // Position it just below the input
  const rect = inputEl.getBoundingClientRect();
  prompt.style.top = `${rect.bottom + window.scrollY + 4}px`;
  prompt.style.left = `${rect.left + window.scrollX}px`;
  document.body.appendChild(prompt);

  const yesBtn = prompt.querySelector('.save-yes');
  const noBtn = prompt.querySelector('.save-no');

  yesBtn.addEventListener('click', () => {
    onSave(fieldLabel, value);
    inputEl.setAttribute(SAVED_ATTR, 'true');
    removeSavePrompt();
    showConfirmationToast(`"${fieldLabel}" saved to your profile ✓`);
  });

  noBtn.addEventListener('click', removeSavePrompt);

  // Auto-dismiss after 8 seconds
  setTimeout(removeSavePrompt, 8000);
}

function removeSavePrompt() {
  document.querySelectorAll(`.${PROMPT_CLASS}`).forEach((el) => el.remove());
}

function showConfirmationToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 999999;
    background: #1a1a2e; color: #e0e0e0; border: 1px solid #4a4aff;
    border-radius: 8px; padding: 10px 16px; font-family: system-ui, sans-serif;
    font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    animation: fadeIn 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Normalize Field Label ─────────────────────────────────────────────────────

/**
 * Derive a storage key from the field's label or name attribute.
 * e.g. "Desired Salary ($)" → "desired_salary"
 * @param {string} raw
 * @returns {string}
 */
function normalizeLabel(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// ─── Save Field to Profile (via background worker) ─────────────────────────────

/**
 * Send the field to the background service worker, which calls storage.js.
 * @param {string} fieldLabel - Raw label text.
 * @param {string} value - The user-entered value.
 */
function saveFieldViaBackground(fieldLabel, value) {
  const key = normalizeLabel(fieldLabel);
  chrome.runtime.sendMessage({
    type: 'SAVE_CUSTOM_FIELD',
    payload: { key, value },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attach "save for future forms" blur listeners to the given unmatched fields.
 * Called by Member 1's autofill engine after injecting highlights.
 *
 * @param {Array<{ element: HTMLElement, label: string }>} unmatchedFields
 *   Array of objects with the DOM element and its detected label string.
 */
export function attachSavePrompts(unmatchedFields) {
  injectStyles();

  unmatchedFields.forEach(({ element, label }) => {
    if (!element || element.getAttribute(SAVED_ATTR)) return;

    element.addEventListener('blur', () => {
      const value = element.value?.trim();
      // Only prompt if the user actually typed something
      if (!value) return;
      // Don't re-prompt if already saved
      if (element.getAttribute(SAVED_ATTR)) return;

      showSavePrompt(element, label, value, saveFieldViaBackground);
    });
  });
}

/**
 * Remove all save prompts from the page (e.g. on navigation).
 */
export function cleanupSavePrompts() {
  removeSavePrompt();
}
