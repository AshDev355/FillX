/**
 * savePromptBridge.js — "Save for Later" Field Feedback Loop
 *
 * Runs inside the webpage. When the user manually types into an unmatched
 * field and blurs, it displays a small floating prompt asking to save the
 * answer to their profile for future autofills.
 * Upon saving, immediately updates visual highlight from Red to Green.
 */

import { MESSAGE_TYPES, MATCH_STATUS } from '../shared/messageTypes.js';
import { highlightMatched } from './highlighter.js';
import { fieldIdentifier } from './fieldIdentifier.js';
import { fieldState } from './fieldState.js';

const SAVED_ATTR = 'data-fillx-saved';
const PROMPT_CLASS = 'fillx-save-prompt';

/**
 * Normalizes a field label into a clean key for storage.
 * e.g. "Desired Salary ($)" -> "desired_salary"
 */
export function normalizeLabel(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectPromptStyles() {
  if (document.getElementById('fillx-save-prompt-styles')) return;

  const style = document.createElement('style');
  style.id = 'fillx-save-prompt-styles';
  style.textContent = `
    .${PROMPT_CLASS} {
      position: absolute;
      z-index: 999999;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #6366f1;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fillx-prompt-pop 0.2s ease-out;
      pointer-events: auto;
      white-space: nowrap;
    }
    .${PROMPT_CLASS} strong {
      color: #a5b4fc;
    }
    .${PROMPT_CLASS} button {
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .${PROMPT_CLASS} .fillx-save-yes {
      background: #6366f1;
      color: white;
    }
    .${PROMPT_CLASS} .fillx-save-yes:hover { background: #4f46e5; }
    .${PROMPT_CLASS} .fillx-save-no {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    .${PROMPT_CLASS} .fillx-save-no:hover { color: #f87171; border-color: #ef4444; }
    .fillx-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #0f172a;
      color: #34d399;
      border: 1px solid #10b981;
      border-radius: 8px;
      padding: 10px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      animation: fillx-prompt-pop 0.2s ease-out;
    }
    @keyframes fillx-prompt-pop {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function removePrompt() {
  document.querySelectorAll(`.${PROMPT_CLASS}`).forEach((el) => el.remove());
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fillx-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Displays the save prompt positioned under the target input.
 */
function showSavePrompt(element, fieldLabel, value) {
  removePrompt();
  injectPromptStyles();

  const prompt = document.createElement('div');
  prompt.className = PROMPT_CLASS;
  prompt.setAttribute('role', 'dialog');

  prompt.innerHTML = `
    <span>💾 Save "<strong>${escapeHtml(fieldLabel)}</strong>" to your profile?</span>
    <button class="fillx-save-yes">Yes, save it</button>
    <button class="fillx-save-no">No thanks</button>
  `;

  const rect = element.getBoundingClientRect();
  prompt.style.top = `${rect.bottom + window.scrollY + 6}px`;
  prompt.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;

  document.body.appendChild(prompt);

  const yesBtn = prompt.querySelector('.fillx-save-yes');
  const noBtn = prompt.querySelector('.fillx-save-no');

  yesBtn.addEventListener('click', () => {
    const key = normalizeLabel(fieldLabel);

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          {
            action: 'SAVE_UNMATCHED_FIELD',
            type: MESSAGE_TYPES.SAVE_CUSTOM_FIELD,
            fieldKey: key,
            fieldValue: value,
            key,
            value,
            label: fieldLabel,
          },
          (response) => {
            if (chrome.runtime?.lastError) {
              // Silently handled
            }

            // Immediately switch highlight from Red to Green
            element.classList.remove('fillx-highlight-unmatched', 'fillx-highlight-ambiguous');
            highlightMatched(element, { label: '✓ Saved' });

            // Update in-memory field state
            if (typeof fieldState !== 'undefined' && fieldState.updateFieldStatus) {
              const fieldId = fieldIdentifier ? fieldIdentifier.getFieldId(element) : null;
              if (fieldId) {
                fieldState.updateFieldStatus(fieldId, MATCH_STATUS.MATCHED, value);
              }
            }
          }
        );
      }
    } catch (e) {
      // Ignored if context invalid
    }

    // Direct UI fallback: switch to green immediately
    element.classList.remove('fillx-highlight-unmatched', 'fillx-highlight-ambiguous');
    highlightMatched(element, { label: '✓ Saved' });

    element.setAttribute(SAVED_ATTR, 'true');
    removePrompt();
    showToast(`✓ "${fieldLabel}" saved to your FillX profile`);
  });

  noBtn.addEventListener('click', removePrompt);

  // Auto-dismiss after 8 seconds
  setTimeout(removePrompt, 8000);
}

/**
 * Attaches blur listeners to unmatched fields to prompt for saving custom answers.
 *
 * @param {Array<{ element: HTMLElement, label: string }>} unmatchedFields
 */
export function attachSavePromptsToUnmatched(unmatchedFields) {
  if (!Array.isArray(unmatchedFields) || unmatchedFields.length === 0) return;

  injectPromptStyles();

  unmatchedFields.forEach(({ element, label }) => {
    if (!element || element.getAttribute(SAVED_ATTR)) return;

    element.addEventListener('blur', () => {
      const value = (element.value || element.textContent || '').trim();
      if (!value || element.getAttribute(SAVED_ATTR)) return;

      showSavePrompt(element, label, value);
    });
  });
}

export function cleanupSavePrompts() {
  removePrompt();
}
