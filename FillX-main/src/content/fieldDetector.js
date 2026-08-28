/**
 * fieldDetector.js — Enhanced Form Field Detection and Clue Extraction
 *
 * Traverses the DOM to identify all fillable form fields, extracts rich
 * contextual metadata, and produces a clean JSON-serializable list.
 *
 * Improvements over the previous version:
 *   - resolveLabel(): 3 new strategies (table cell sibling, title attr, grandparent context)
 *   - extractNearbyText(): walks up 2 levels for richer context
 *   - detectFormFields(): captures data-testid / data-name / data-label / data-field attributes
 *     for React / test-id-heavy apps; adds titleAttr + dataAttrs to the descriptor
 */

import { fieldIdentifier } from './fieldIdentifier.js';

const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file', // Never auto-fill file upload inputs
]);

// ─── Visibility Check ─────────────────────────────────────────────────────────

/**
 * Checks if an element is visible in the layout.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse'
  ) return false;
  if (parseFloat(style.opacity) === 0) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && element.tagName !== 'SELECT') return false;

  return true;
}

// ─── Text Utilities ───────────────────────────────────────────────────────────

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Label Resolution ─────────────────────────────────────────────────────────

/**
 * Resolves the primary label text for a form element across 9 strategies,
 * ordered by specificity.
 *
 * @param {HTMLElement} element
 * @returns {string}
 */
export function resolveLabel(element) {
  if (!element) return '';

  // 1. Explicit <label for="id">
  if (element.id) {
    try {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl) {
        const text = cleanText(labelEl.textContent);
        if (text) return text;
      }
    } catch {}
  }

  // 2. Enclosing <label>
  const enclosingLabel = element.closest('label');
  if (enclosingLabel) {
    const clone = enclosingLabel.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, button').forEach((c) => c.remove());
    const text = cleanText(clone.textContent);
    if (text) return text;
  }

  // 3. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const pieces = labelledBy
      .split(/\s+/)
      .map((id) => {
        const el = document.getElementById(id);
        return el ? cleanText(el.textContent) : '';
      })
      .filter(Boolean);
    if (pieces.length > 0) return pieces.join(' ');
  }

  // 4. aria-label attribute
  const ariaLabel = cleanText(element.getAttribute('aria-label') || '');
  if (ariaLabel) return ariaLabel;

  // 5. Preceding sibling label / span / paragraph
  let prev = element.previousElementSibling;
  while (prev) {
    if (['LABEL', 'SPAN', 'P', 'DIV', 'STRONG', 'B', 'LEGEND'].includes(prev.tagName)) {
      const text = cleanText(prev.textContent);
      if (text && text.length <= 120) return text;
    }
    prev = prev.previousElementSibling;
  }

  // 6. Table cell sibling — element inside a <td>, look at previous <td> or <th>
  const parentCell = element.closest('td');
  if (parentCell) {
    const prevCell = parentCell.previousElementSibling;
    if (prevCell && ['TD', 'TH'].includes(prevCell.tagName)) {
      const text = cleanText(prevCell.textContent);
      if (text && text.length <= 120) return text;
    }
  }

  // 7. Closest <fieldset> <legend>
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const text = cleanText(legend.textContent);
      if (text) return text;
    }
  }

  // 8. title attribute (last-resort attribute fallback)
  const title = cleanText(element.getAttribute('title') || '');
  if (title) return title;

  // 9. Grandparent context scan — walk up 2 parent levels and read first text node
  let ancestor = element.parentElement;
  for (let depth = 0; depth < 2 && ancestor; depth++, ancestor = ancestor.parentElement) {
    // Scan child nodes for raw text nodes that are meaningful
    for (const node of Array.from(ancestor.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = cleanText(node.textContent || '');
        if (text && text.length >= 2 && text.length <= 80) return text;
      }
    }
  }

  return '';
}

// ─── Nearby Text ──────────────────────────────────────────────────────────────

/**
 * Extracts surrounding textual context for disambiguation.
 * Walks up 2 parent levels for richer context.
 *
 * @param {HTMLElement} element
 * @returns {string}
 */
export function extractNearbyText(element) {
  if (!element) return '';

  let context = '';
  let ancestor = element.parentElement;

  for (let depth = 0; depth < 2 && ancestor; depth++, ancestor = ancestor.parentElement) {
    const text = cleanText(ancestor.textContent || '');
    if (text.length > context.length) context = text;
    if (context.length >= 180) break;
  }

  return context.slice(0, 200);
}

// ─── Select Options ───────────────────────────────────────────────────────────

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

// ─── Data Attributes ─────────────────────────────────────────────────────────

/**
 * Extracts React / test-id style data-* attributes that carry label information.
 * @param {HTMLElement} element
 * @returns {Record<string, string>}
 */
function extractDataAttributes(element) {
  const attrs = {};
  const relevantKeys = ['data-testid', 'data-name', 'data-label', 'data-field', 'data-id', 'data-key'];
  for (const key of relevantKeys) {
    const val = element.getAttribute(key);
    if (val) attrs[key] = val;
  }
  return attrs;
}

// ─── Main Detection ───────────────────────────────────────────────────────────

/**
 * Scans the given root for all fillable form fields and returns a rich descriptor
 * array for the matching engine.
 *
 * @param {HTMLElement|Document} [root=document]
 * @returns {Array<object>}
 */
export function detectFormFields(root = document) {
  const container = root || document;
  const candidates = container.querySelectorAll(
    'input, textarea, select, [contenteditable="true"]'
  );
  const detectedFields = [];

  candidates.forEach((element) => {
    const tagName = element.tagName.toUpperCase();
    const isContentEditable = element.getAttribute('contenteditable') === 'true';

    const type = (
      element.getAttribute('type') ||
      (tagName === 'TEXTAREA' || isContentEditable
        ? 'textarea'
        : tagName === 'SELECT'
        ? 'select'
        : 'text')
    ).toLowerCase();

    // Skip non-fillable input types
    if (tagName === 'INPUT' && IGNORED_INPUT_TYPES.has(type)) return;

    // Skip disabled or read-only elements
    if (element.disabled || element.readOnly) return;

    // Skip invisible elements
    if (!isElementVisible(element)) return;

    // Register with FieldIdentifier for a stable unique fieldId
    const fieldId = fieldIdentifier.register(element);

    // Extract all context signals
    const label = resolveLabel(element);
    const placeholder = element.getAttribute('placeholder') || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const name = element.getAttribute('name') || '';
    const id = element.id || '';
    const nearbyText = extractNearbyText(element);
    const autocomplete = element.getAttribute('autocomplete') || '';
    const required =
      element.required || element.getAttribute('aria-required') === 'true';
    const titleAttr = element.getAttribute('title') || '';
    const dataAttrs = extractDataAttributes(element);

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
      isContentEditable,
      titleAttr,
      dataAttrs,
    };

    if (tagName === 'SELECT') {
      fieldDescriptor.options = extractSelectOptions(element);
    }

    detectedFields.push(fieldDescriptor);
  });

  return detectedFields;
}
