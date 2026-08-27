/**
 * highlighter.js — Reversible, Non-Destructive Field Highlighting & Badges
 *
 * Provides visual indication for:
 * - MATCHED: Confident match filled (green outline + badge)
 * - AMBIGUOUS: Potential match needing user verification (amber outline + badge)
 * - UNMATCHED: No match found, requires manual entry (dashed red outline + badge)
 *
 * Features:
 * - Caches original inline styles to prevent permanently altering host page styles
 * - Reversible: full restoration on clearHighlight() / clearAllHighlights()
 * - Single managed style tag injection to prevent duplicate stylesheet bloat
 */

const STYLE_ID = 'fillx-highlighter-styles';
const BADGE_ATTR = 'data-fillx-badge-for';
const ORIG_STYLE_ATTR = 'data-fillx-orig-style';
const HIGHLIGHT_STATE_ATTR = 'data-fillx-highlight-state';

const CLASSES = {
  MATCHED: 'fillx-highlight-matched',
  AMBIGUOUS: 'fillx-highlight-ambiguous',
  UNMATCHED: 'fillx-highlight-unmatched',
};

const BADGE_CLASSES = {
  MATCHED: 'fillx-badge-matched',
  AMBIGUOUS: 'fillx-badge-ambiguous',
  UNMATCHED: 'fillx-badge-unmatched',
};

const BADGE_LABELS = {
  MATCHED: '✓ Matched',
  AMBIGUOUS: '⚠ Review',
  UNMATCHED: '✕ Unmatched',
};

/**
 * Injects the highlighter CSS rules into the document head if not already present.
 */
export function injectHighlighterStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    .fillx-highlight-matched {
      outline: 2px solid #10b981 !important;
      outline-offset: 1px !important;
      background-color: rgba(16, 185, 129, 0.08) !important;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.25) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    .fillx-highlight-ambiguous {
      outline: 2px solid #f59e0b !important;
      outline-offset: 1px !important;
      background-color: rgba(245, 158, 11, 0.08) !important;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.25) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    .fillx-highlight-unmatched {
      outline: 2px dashed #ef4444 !important;
      outline-offset: 1px !important;
      background-color: rgba(239, 68, 68, 0.08) !important;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.25) !important;
      transition: outline 0.2s ease, box-shadow 0.2s ease !important;
    }
    .fillx-badge-container {
      position: absolute;
      z-index: 999990;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      padding: 3px 7px;
      border-radius: 4px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      pointer-events: none;
      animation: fillx-badge-fade 0.2s ease-out;
    }
    .fillx-badge-matched {
      background-color: #065f46;
      color: #a7f3d0;
      border: 1px solid #10b981;
    }
    .fillx-badge-ambiguous {
      background-color: #78350f;
      color: #fde68a;
      border: 1px solid #f59e0b;
    }
    .fillx-badge-unmatched {
      background-color: #7f1d1d;
      color: #fecaca;
      border: 1px solid #ef4444;
    }
    @keyframes fillx-badge-fade {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);
}

/**
 * Creates or updates an indicator badge positioned adjacent to the element.
 */
function attachBadge(element, state, customLabel) {
  const fieldId = element.getAttribute('data-fillx-id') || element.id || element.name;
  if (!fieldId) return;

  removeBadge(element);

  const badge = document.createElement('div');
  badge.className = `fillx-badge-container ${BADGE_CLASSES[state]}`;
  badge.setAttribute(BADGE_ATTR, fieldId);
  badge.textContent = customLabel || BADGE_LABELS[state];

  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY - 18;
  const left = Math.max(0, rect.right + window.scrollX - 70);

  badge.style.top = `${Math.max(0, top)}px`;
  badge.style.left = `${left}px`;

  document.body.appendChild(badge);
}

/**
 * Removes the badge associated with a given element.
 */
function removeBadge(element) {
  const fieldId = element.getAttribute('data-fillx-id') || element.id || element.name;
  if (!fieldId) return;

  const existingBadge = document.querySelector(`[${BADGE_ATTR}="${CSS.escape(fieldId)}"]`);
  if (existingBadge) {
    existingBadge.remove();
  }
}

/**
 * Removes all FillX badges from the document.
 */
function removeAllBadges() {
  document.querySelectorAll('.fillx-badge-container').forEach((badge) => badge.remove());
}

/**
 * Core internal function to apply a highlight state.
 */
function applyHighlight(element, state, options = {}) {
  if (!element || !(element instanceof HTMLElement)) return;

  injectHighlighterStyles();

  // Cache original inline style once before any modifications
  if (!element.hasAttribute(ORIG_STYLE_ATTR)) {
    element.setAttribute(ORIG_STYLE_ATTR, element.getAttribute('style') || '');
  }

  // Clear existing highlight classes
  element.classList.remove(CLASSES.MATCHED, CLASSES.AMBIGUOUS, CLASSES.UNMATCHED);

  // Apply new class and state attribute
  element.classList.add(CLASSES[state]);
  element.setAttribute(HIGHLIGHT_STATE_ATTR, state.toLowerCase());

  // Attach status badge if not explicitly disabled
  if (options.showBadge !== false) {
    attachBadge(element, state, options.label);
  }
}

export function highlightMatched(element, options = {}) {
  applyHighlight(element, 'MATCHED', options);
}

export function highlightAmbiguous(element, options = {}) {
  applyHighlight(element, 'AMBIGUOUS', options);
}

export function highlightUnmatched(element, options = {}) {
  applyHighlight(element, 'UNMATCHED', options);
}

export function clearHighlight(element) {
  if (!element || !(element instanceof HTMLElement)) return;

  element.classList.remove(CLASSES.MATCHED, CLASSES.AMBIGUOUS, CLASSES.UNMATCHED);
  element.removeAttribute(HIGHLIGHT_STATE_ATTR);

  if (element.hasAttribute(ORIG_STYLE_ATTR)) {
    const origStyle = element.getAttribute(ORIG_STYLE_ATTR);
    if (origStyle) {
      element.setAttribute('style', origStyle);
    } else {
      element.removeAttribute('style');
    }
    element.removeAttribute(ORIG_STYLE_ATTR);
  }

  removeBadge(element);
}

export function clearAllHighlights() {
  const highlighted = document.querySelectorAll(
    `.${CLASSES.MATCHED}, .${CLASSES.AMBIGUOUS}, .${CLASSES.UNMATCHED}, [${HIGHLIGHT_STATE_ATTR}]`
  );

  highlighted.forEach((el) => clearHighlight(el));
  removeAllBadges();
}
