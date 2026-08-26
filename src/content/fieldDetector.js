/**
 * fieldDetector.js — Form Field Detection and Clue Extraction
 *
 * Traverses the DOM to identify all fillable form fields (<input>, <textarea>, <select>),
 * filters out non-fillable elements (submit buttons, hidden fields, file inputs),
 * extracts rich context clues (labels, aria-labels, placeholders, nearby text),
 * and produces a clean JSON-serializable list matching the backend /api/match contract.
 */

import { fieldIdentifier } from './fieldIdentifier.js';

// Input types that should NOT be detected for autofilling
const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file', // For security and browser limitations, never auto-fill file uploads
]);

/**
 * Checks if an element is visible in the viewport or layout.
 *
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }
  if (parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  // Elements with 0 width and height that aren't inputs might be hidden
  if (rect.width === 0 && rect.height === 0 && element.tagName !== 'SELECT') {
    return false;
  }

  return true;
}

/**
 * Cleans and normalizes extracted label/text content.
 *
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves the primary label text for a given form element.
 *
 * Checks in order:
 * 1. <label for="id"> matching element.id
 * 2. Enclosing <label> element
 * 3. aria-labelledby target elements
 * 4. aria-label attribute
 * 5. Parent / preceding label or descriptive sibling
 *
 * @param {HTMLElement} element
 * @returns {string}
 */
export function resolveLabel(element) {
  if (!element) return '';

  // 1. Explicit <label for="id">
  if (element.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (labelEl) {
      const text = cleanText(labelEl.textContent);
      if (text) return text;
    }
  }

  // 2. Enclosing <label>
  const enclosingLabel = element.closest('label');
  if (enclosingLabel) {
    // Clone label to remove the input's own text if needed
    const clone = enclosingLabel.cloneNode(true);
    const childInputs = clone.querySelectorAll('input, select, textarea, button');
    childInputs.forEach((child) => child.remove());
    const text = cleanText(clone.textContent);
    if (text) return text;
  }

  // 3. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const textPieces = [];
    for (const id of ids) {
      const refEl = document.getElementById(id);
      if (refEl) {
        const t = cleanText(refEl.textContent);
        if (t) textPieces.push(t);
      }
    }
    if (textPieces.length > 0) return textPieces.join(' ');
  }

  // 4. aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    const text = cleanText(ariaLabel);
    if (text) return text;
  }

  // 5. Preceding sibling label or span
  let prev = element.previousElementSibling;
  while (prev) {
    if (['LABEL', 'SPAN', 'P', 'DIV', 'STRONG', 'B'].includes(prev.tagName)) {
      const text = cleanText(prev.textContent);
      if (text && text.length <= 100) return text;
    }
    prev = prev.previousElementSibling;
  }

  // 6. Closest fieldset legend
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const text = cleanText(legend.textContent);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Extracts surrounding / nearby textual context for disambiguation.
 *
 * @param {HTMLElement} element
 * @returns {string}
 */
export function extractNearbyText(element) {
  if (!element) return '';

  const parent = element.parentElement;
  if (!parent) return '';

  // Get text content of immediate parent container, truncated to reasonable length
  let context = cleanText(parent.textContent || '');
  if (context.length > 150) {
    context = context.slice(0, 150);
  }

  return context;
}

/**
 * Extracts selectable options from a <select> element.
 *
 * @param {HTMLSelectElement} selectEl
 * @returns {Array<string>}
 */
function extractSelectOptions(selectEl) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return [];

  const options = [];
  for (const opt of Array.from(selectEl.options)) {
    const text = cleanText(opt.textContent || opt.value || '');
    if (text && !opt.disabled && opt.value !== '') {
      options.push(text);
    }
  }
  return options;
}

/**
 * Main form field detection function.
 * Scans the DOM (or root container) and returns all fillable field descriptor objects.
 *
 * @param {HTMLElement|Document} [root=document]
 * @returns {Array<object>} List of detected field representations
 */
export function detectFormFields(root = document) {
  const container = root || document;
  const candidates = container.querySelectorAll('input, textarea, select');
  const detectedFields = [];

  candidates.forEach((element) => {
    const tagName = element.tagName.toUpperCase();
    const type = (element.getAttribute('type') || (tagName === 'TEXTAREA' ? 'textarea' : tagName === 'SELECT' ? 'select' : 'text')).toLowerCase();

    // Skip ignored types
    if (tagName === 'INPUT' && IGNORED_INPUT_TYPES.has(type)) {
      return;
    }

    // Skip disabled or read-only elements
    if (element.disabled || element.readOnly) {
      return;
    }

    // Skip invisible elements
    if (!isElementVisible(element)) {
      return;
    }

    // Register with FieldIdentifier to get stable unique fieldId
    const fieldId = fieldIdentifier.register(element);

    // Extract clues
    const label = resolveLabel(element);
    const placeholder = element.getAttribute('placeholder') || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const name = element.getAttribute('name') || '';
    const id = element.id || '';
    const nearbyText = extractNearbyText(element);
    const autocomplete = element.getAttribute('autocomplete') || '';
    const required = element.required || element.getAttribute('aria-required') === 'true';

    const fieldDescriptor = {
      fieldId,
      tagName,
      type,
      name,
      id,
      placeholder,
      label,
      ariaLabel,
      nearbyText,
      required,
      autocomplete,
    };

    if (tagName === 'SELECT') {
      fieldDescriptor.options = extractSelectOptions(element);
    }

    detectedFields.push(fieldDescriptor);
  });

  return detectedFields;
}
