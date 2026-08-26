/**
 * savePromptBridge.js — Bridge for Member 4's Save-Field-Prompt
 *
 * Integrates with Member 4's SaveFieldPrompt.js (attachSavePrompts) on unmatched fields.
 * If Member 4's module is not loaded yet in standalone testing, provides a clean fallback
 * so user blur events on unmatched fields can still be captured and saved.
 */

const SAVED_ATTR = 'data-autofill-saved';
const PROMPT_CLASS = 'fillx-save-prompt';

/**
 * Normalizes a field label into a clean key for storage.
 * e.g., "Favorite Color ($)" -> "favorite_color"
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLabel(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Shows a lightweight fallback save prompt if Member 4's prompt is not present.
 *
 * @param {HTMLElement} element
 * @param {string} label
 * @param {string} value
 */
function showFallbackSavePrompt(element, label, value) {
  document.querySelectorAll(`.${PROMPT_CLASS}`).forEach((p) => p.remove());

  const prompt = document.createElement('div');
  prompt.className = PROMPT_CLASS;
  prompt.style.cssText = `
    position: absolute; z-index: 999999; background: #1e1b4b; color: #e0e7ff;
    border: 1px solid #6366f1; border-radius: 6px; padding: 6px 10px;
    font-family: system-ui, sans-serif; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex; align-items: center; gap: 8px;
  `;

  prompt.innerHTML = `
    <span>💾 Save "<strong>${escapeHtml(label)}</strong>"?</span>
    <button class="fillx-save-yes" style="background:#6366f1;color:#fff;border:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Save</button>
    <button class="fillx-save-no" style="background:transparent;color:#94a3b8;border:1px solid #475569;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px;">✕</button>
  `;

  const rect = element.getBoundingClientRect();
  prompt.style.top = `${rect.bottom + window.scrollY + 4}px`;
  prompt.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(prompt);

  prompt.querySelector('.fillx-save-yes').addEventListener('click', () => {
    const key = normalizeLabel(label);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SAVE_CUSTOM_FIELD',
        payload: { key, value, label },
      });
    }
    element.setAttribute(SAVED_ATTR, 'true');
    prompt.remove();
  });

  prompt.querySelector('.fillx-save-no').addEventListener('click', () => prompt.remove());
  setTimeout(() => prompt.remove(), 8000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Attaches blur listeners to unmatched fields to trigger the save prompt when user enters data.
 *
 * @param {Array<{ element: HTMLElement, label: string }>} unmatchedFields
 */
export function attachSavePromptsToUnmatched(unmatchedFields) {
  if (!Array.isArray(unmatchedFields) || unmatchedFields.length === 0) return;

  // Check if Member 4's window.attachSavePrompts is available globally
  if (typeof window.attachSavePrompts === 'function') {
    window.attachSavePrompts(unmatchedFields);
    return;
  }

  // Fallback handler
  unmatchedFields.forEach(({ element, label }) => {
    if (!element || element.getAttribute(SAVED_ATTR)) return;

    element.addEventListener('blur', () => {
      const value = element.value?.trim();
      if (!value || element.getAttribute(SAVED_ATTR)) return;

      showFallbackSavePrompt(element, label, value);
    }, { once: false });
  });
}
