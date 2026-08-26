/**
 * FillX Extension — Content Script Standalone Bundle
 * Complete, production-ready bundle combining all Member 1 content modules.
 */
(() => {
  'use strict';

  // ─── Module: shared/messageTypes.js ───
  const MESSAGE_TYPES = {
    SCAN_PAGE: 'FILLX_SCAN_PAGE',
    SCAN_PAGE_RESPONSE: 'FILLX_SCAN_PAGE_RESPONSE',
    AUTOFILL_PAGE: 'FILLX_AUTOFILL_PAGE',
    AUTOFILL_PAGE_RESPONSE: 'FILLX_AUTOFILL_PAGE_RESPONSE',
    GET_PAGE_STATUS: 'FILLX_GET_PAGE_STATUS',
    GET_PAGE_STATUS_RESPONSE: 'FILLX_GET_PAGE_STATUS_RESPONSE',
    CLEAR_HIGHLIGHTS: 'FILLX_CLEAR_HIGHLIGHTS',
    CLEAR_HIGHLIGHTS_RESPONSE: 'FILLX_CLEAR_HIGHLIGHTS_RESPONSE',
    RESCAN_PAGE: 'FILLX_RESCAN_PAGE',
    MATCH_FIELDS: 'FILLX_MATCH_FIELDS',
    MATCH_FIELDS_RESPONSE: 'FILLX_MATCH_FIELDS_RESPONSE',
    SAVE_CUSTOM_FIELD: 'SAVE_CUSTOM_FIELD',
    SET_TEST_MODE: 'FILLX_SET_TEST_MODE',
    GET_TEST_MODE: 'FILLX_GET_TEST_MODE',
  };

  const MATCH_STATUS = {
    MATCHED: 'matched',
    AMBIGUOUS: 'ambiguous',
    NO_MATCH: 'no_match',
  };

  const FIELD_TYPES = {
    TEXT: 'text',
    EMAIL: 'email',
    TEL: 'tel',
    NUMBER: 'number',
    URL: 'url',
    DATE: 'date',
    PASSWORD: 'password',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    SELECT: 'select',
    TEXTAREA: 'textarea',
    FILE: 'file',
    HIDDEN: 'hidden',
    SUBMIT: 'submit',
    BUTTON: 'button',
  };

  // ─── Module: content/fieldIdentifier.js ───
  class FieldIdentifierRegistry {
    constructor() {
      this._idToElement = new Map();
      this._elementToId = new WeakMap();
      this._counter = 0;
    }

    clear() {
      this._idToElement.clear();
      this._counter = 0;
    }

    generateFieldId(element, index) {
      const existingId = element.getAttribute('data-fillx-id');
      if (existingId && this._idToElement.has(existingId)) {
        return existingId;
      }

      const tagName = (element.tagName || 'input').toLowerCase();
      const type = (element.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : tagName === 'select' ? 'select' : 'text')).toLowerCase();
      const nameOrId = (element.name || element.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);

      this._counter += 1;
      const base = nameOrId ? `${nameOrId}_${type}` : `${type}`;
      const fieldId = `field_${this._counter}_${base}`;

      return fieldId;
    }

    register(element, customId = null) {
      if (!element || !(element instanceof HTMLElement)) {
        return null;
      }

      const existingId = this._elementToId.get(element);
      if (existingId && this._idToElement.get(existingId) === element) {
        return existingId;
      }

      const fieldId = customId || this.generateFieldId(element, this._counter);
      element.setAttribute('data-fillx-id', fieldId);

      this._idToElement.set(fieldId, element);
      this._elementToId.set(element, fieldId);

      return fieldId;
    }

    getElement(fieldId) {
      if (!fieldId) return null;
      const element = this._idToElement.get(fieldId);
      if (element && document.contains(element)) {
        return element;
      }
      const found = document.querySelector(`[data-fillx-id="${CSS.escape(fieldId)}"]`);
      if (found) {
        this._idToElement.set(fieldId, found);
        this._elementToId.set(found, fieldId);
        return found;
      }
      return null;
    }

    getFieldId(element) {
      if (!element || !(element instanceof HTMLElement)) return null;
      return this._elementToId.get(element) || element.getAttribute('data-fillx-id') || null;
    }

    getAllRegistered() {
      const list = [];
      for (const [fieldId, element] of this._idToElement.entries()) {
        if (document.contains(element)) {
          list.push({ fieldId, element });
        }
      }
      return list;
    }
  }

  const fieldIdentifier = new FieldIdentifierRegistry();

  // ─── Module: content/fieldDetector.js ───
  const IGNORED_INPUT_TYPES = new Set([
    'hidden',
    'submit',
    'button',
    'reset',
    'image',
    'file',
  ]);

  function isElementVisible(element) {
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
    if (rect.width === 0 && rect.height === 0 && element.tagName !== 'SELECT') {
      return false;
    }

    return true;
  }

  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveLabel(element) {
    if (!element) return '';

    if (element.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl) {
        const text = cleanText(labelEl.textContent);
        if (text) return text;
      }
    }

    const enclosingLabel = element.closest('label');
    if (enclosingLabel) {
      const clone = enclosingLabel.cloneNode(true);
      const childInputs = clone.querySelectorAll('input, select, textarea, button');
      childInputs.forEach((child) => child.remove());
      const text = cleanText(clone.textContent);
      if (text) return text;
    }

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

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const text = cleanText(ariaLabel);
      if (text) return text;
    }

    let prev = element.previousElementSibling;
    while (prev) {
      if (['LABEL', 'SPAN', 'P', 'DIV', 'STRONG', 'B'].includes(prev.tagName)) {
        const text = cleanText(prev.textContent);
        if (text && text.length <= 100) return text;
      }
      prev = prev.previousElementSibling;
    }

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

  function extractNearbyText(element) {
    if (!element) return '';
    const parent = element.parentElement;
    if (!parent) return '';

    let context = cleanText(parent.textContent || '');
    if (context.length > 150) {
      context = context.slice(0, 150);
    }
    return context;
  }

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

  function detectFormFields(root = document) {
    const container = root || document;
    const candidates = container.querySelectorAll('input, textarea, select');
    const detectedFields = [];

    candidates.forEach((element) => {
      const tagName = element.tagName.toUpperCase();
      const type = (element.getAttribute('type') || (tagName === 'TEXTAREA' ? 'textarea' : tagName === 'SELECT' ? 'select' : 'text')).toLowerCase();

      if (tagName === 'INPUT' && IGNORED_INPUT_TYPES.has(type)) {
        return;
      }

      if (element.disabled || element.readOnly) {
        return;
      }

      if (!isElementVisible(element)) {
        return;
      }

      const fieldId = fieldIdentifier.register(element);
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

  // ─── Module: content/valueSetter.js ───
  function setInputValue(inputEl, value) {
    const stringVal = value !== null && value !== undefined ? String(value) : '';
    const previousValue = inputEl.value;

    const prototype = Object.getPrototypeOf(inputEl);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') ||
                       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(inputEl, stringVal);
    } else {
      inputEl.value = stringVal;
    }

    if (inputEl._valueTracker) {
      inputEl._valueTracker.setValue(previousValue);
    }
  }

  function setTextareaValue(textareaEl, value) {
    const stringVal = value !== null && value !== undefined ? String(value) : '';
    const previousValue = textareaEl.value;

    const prototype = Object.getPrototypeOf(textareaEl);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') ||
                       Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(textareaEl, stringVal);
    } else {
      textareaEl.value = stringVal;
    }

    if (textareaEl._valueTracker) {
      textareaEl._valueTracker.setValue(previousValue);
    }
  }

  function setSelectValue(selectEl, value) {
    if (!selectEl || !value) return false;

    const target = String(value).trim().toLowerCase();
    let matchedIndex = -1;

    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      if (opt.value.trim().toLowerCase() === target) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        if (opt.textContent.trim().toLowerCase() === target) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex === -1) {
      for (let i = 0; i < selectEl.options.length; i++) {
        const opt = selectEl.options[i];
        const text = opt.textContent.trim().toLowerCase();
        const val = opt.value.trim().toLowerCase();
        if (text.includes(target) || target.includes(text) || val.includes(target)) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex !== -1) {
      selectEl.selectedIndex = matchedIndex;
      const option = selectEl.options[matchedIndex];
      if (option) {
        option.selected = true;
      }
      return true;
    }

    return false;
  }

  function setCheckboxOrRadioValue(inputEl, checkedState) {
    const isChecked = typeof checkedState === 'boolean'
      ? checkedState
      : ['true', '1', 'yes', 'on', 'checked'].includes(String(checkedState).toLowerCase());

    const previousChecked = inputEl.checked;
    const prototype = Object.getPrototypeOf(inputEl);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'checked') ||
                       Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');

    if (descriptor && descriptor.set) {
      descriptor.set.call(inputEl, isChecked);
    } else {
      inputEl.checked = isChecked;
    }

    if (inputEl._valueTracker) {
      inputEl._valueTracker.setValue(String(previousChecked));
    }
  }

  function dispatchFormEvents(element) {
    if (!element || !(element instanceof HTMLElement)) return;

    element.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: true }));

    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertReplacementText',
    });
    element.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(changeEvent);

    element.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
  }

  function setFieldValue(element, value) {
    if (!element || !(element instanceof HTMLElement)) {
      return { success: false, error: 'Invalid DOM element' };
    }

    const tagName = element.tagName.toUpperCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    const previousValue = element.value;

    try {
      if (tagName === 'SELECT') {
        const selected = setSelectValue(element, value);
        dispatchFormEvents(element);
        return { success: selected, previousValue, newValue: element.value };
      }

      if (tagName === 'TEXTAREA') {
        setTextareaValue(element, value);
        dispatchFormEvents(element);
        return { success: true, previousValue, newValue: element.value };
      }

      if (tagName === 'INPUT') {
        if (type === 'checkbox' || type === 'radio') {
          setCheckboxOrRadioValue(element, value);
          dispatchFormEvents(element);
          return { success: true, previousValue: element.checked, newValue: element.checked };
        }

        setInputValue(element, value);
        dispatchFormEvents(element);
        return { success: true, previousValue, newValue: element.value };
      }

      return { success: false, error: `Unsupported element type: ${tagName}` };
    } catch (err) {
      console.error('FillX: Error setting field value:', err);
      return { success: false, error: err.message };
    }
  }

  // ─── Module: content/highlighter.js ───
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

  function injectHighlighterStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .fillx-highlight-matched {
        outline: 2px solid #10b981 !important;
        outline-offset: 1px !important;
        background-color: rgba(16, 185, 129, 0.08) !important;
        box-shadow: 0 0 6px rgba(16, 185, 129, 0.25) !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease !important;
      }
      .fillx-highlight-ambiguous {
        outline: 2px solid #f59e0b !important;
        outline-offset: 1px !important;
        background-color: rgba(245, 158, 11, 0.08) !important;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.25) !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease !important;
      }
      .fillx-highlight-unmatched {
        outline: 2px dashed #ef4444 !important;
        outline-offset: 1px !important;
        background-color: rgba(239, 68, 68, 0.08) !important;
        box-shadow: 0 0 6px rgba(239, 68, 68, 0.25) !important;
        transition: outline 0.2s ease, box-shadow 0.2s ease !important;
      }
      .fillx-badge-container {
        position: absolute;
        z-index: 999990;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
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
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(styleEl);
  }

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

  function removeBadge(element) {
    const fieldId = element.getAttribute('data-fillx-id') || element.id || element.name;
    if (!fieldId) return;

    const existingBadge = document.querySelector(`[${BADGE_ATTR}="${CSS.escape(fieldId)}"]`);
    if (existingBadge) {
      existingBadge.remove();
    }
  }

  function removeAllBadges() {
    document.querySelectorAll('.fillx-badge-container').forEach((badge) => badge.remove());
  }

  function applyHighlight(element, state, options = {}) {
    if (!element || !(element instanceof HTMLElement)) return;

    injectHighlighterStyles();

    if (!element.hasAttribute(ORIG_STYLE_ATTR)) {
      element.setAttribute(ORIG_STYLE_ATTR, element.getAttribute('style') || '');
    }

    element.classList.remove(CLASSES.MATCHED, CLASSES.AMBIGUOUS, CLASSES.UNMATCHED);
    element.classList.add(CLASSES[state]);
    element.setAttribute(HIGHLIGHT_STATE_ATTR, state.toLowerCase());

    if (options.showBadge !== false) {
      attachBadge(element, state, options.label);
    }
  }

  function highlightMatched(element, options = {}) {
    applyHighlight(element, 'MATCHED', options);
  }

  function highlightAmbiguous(element, options = {}) {
    applyHighlight(element, 'AMBIGUOUS', options);
  }

  function highlightUnmatched(element, options = {}) {
    applyHighlight(element, 'UNMATCHED', options);
  }

  function clearHighlight(element) {
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

  function clearAllHighlights() {
    const highlighted = document.querySelectorAll(
      `.${CLASSES.MATCHED}, .${CLASSES.AMBIGUOUS}, .${CLASSES.UNMATCHED}, [${HIGHLIGHT_STATE_ATTR}]`
    );

    highlighted.forEach((el) => clearHighlight(el));
    removeAllBadges();
  }

  // ─── Module: content/fieldState.js ───
  class FieldStateManager {
    constructor() {
      this.detectedFields = [];
      this.matchingResults = [];
      this.fieldStatusMap = new Map();
    }

    reset() {
      this.detectedFields = [];
      this.matchingResults = [];
      this.fieldStatusMap.clear();
    }

    setDetectedFields(fields) {
      this.detectedFields = Array.isArray(fields) ? [...fields] : [];
    }

    setMatchingResults(results) {
      this.matchingResults = Array.isArray(results) ? [...results] : [];
      this.fieldStatusMap.clear();

      for (const res of this.matchingResults) {
        if (res && res.fieldId) {
          this.fieldStatusMap.set(res.fieldId, {
            status: res.status || MATCH_STATUS.NO_MATCH,
            value: res.value || null,
            confidence: typeof res.confidence === 'number' ? res.confidence : null,
            isOpenEnded: Boolean(res.isOpenEnded),
          });
        }
      }
    }

    getStats() {
      let matchedCount = 0;
      let ambiguousCount = 0;
      let unmatchedCount = 0;

      for (const [_, info] of this.fieldStatusMap.entries()) {
        if (info.status === MATCH_STATUS.MATCHED) {
          matchedCount += 1;
        } else if (info.status === MATCH_STATUS.AMBIGUOUS) {
          ambiguousCount += 1;
        } else {
          unmatchedCount += 1;
        }
      }

      const accountedCount = matchedCount + ambiguousCount + unmatchedCount;
      if (this.detectedFields.length > accountedCount) {
        unmatchedCount += (this.detectedFields.length - accountedCount);
      }

      const totalFields = this.detectedFields.length;
      const fieldsNeedAttention = ambiguousCount + unmatchedCount;

      return {
        totalFields,
        matchedCount,
        ambiguousCount,
        unmatchedCount,
        fieldsNeedAttention,
      };
    }

    getUnmatchedFieldsForPrompt() {
      const list = [];

      for (const field of this.detectedFields) {
        const statusInfo = this.fieldStatusMap.get(field.fieldId);
        const status = statusInfo ? statusInfo.status : MATCH_STATUS.NO_MATCH;

        if (status === MATCH_STATUS.NO_MATCH || status === MATCH_STATUS.AMBIGUOUS) {
          const element = fieldIdentifier.getElement(field.fieldId);
          if (element) {
            list.push({
              element,
              label: field.label || field.placeholder || field.name || 'Custom Field',
              fieldId: field.fieldId,
            });
          }
        }
      }

      return list;
    }
  }

  const fieldState = new FieldStateManager();

  // ─── Module: content/savePromptBridge.js ───
  const SAVED_ATTR = 'data-autofill-saved';
  const PROMPT_CLASS = 'fillx-save-prompt';

  function normalizeLabel(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  }

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

  function attachSavePromptsToUnmatched(unmatchedFields) {
    if (!Array.isArray(unmatchedFields) || unmatchedFields.length === 0) return;

    if (typeof window.attachSavePrompts === 'function') {
      window.attachSavePrompts(unmatchedFields);
      return;
    }

    unmatchedFields.forEach(({ element, label }) => {
      if (!element || element.getAttribute(SAVED_ATTR)) return;

      element.addEventListener('blur', () => {
        const value = element.value?.trim();
        if (!value || element.getAttribute(SAVED_ATTR)) return;

        showFallbackSavePrompt(element, label, value);
      }, { once: false });
    });
  }

  // ─── Module: content/dynamicObserver.js ───
  class DynamicFormObserver {
    constructor() {
      this._observer = null;
      this._rescanCallback = null;
      this._debounceTimeout = null;
      this._debounceMs = 400;
    }

    start(onNewFieldsDetected) {
      this._rescanCallback = onNewFieldsDetected;

      if (this._observer) {
        this._observer.disconnect();
      }

      this._observer = new MutationObserver((mutations) => {
        let relevantChange = false;

        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (
                  node.classList?.contains('fillx-badge-container') ||
                  node.classList?.contains('fillx-save-prompt') ||
                  node.id === 'fillx-highlighter-styles'
                ) {
                  continue;
                }

                if (
                  ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName) ||
                  node.querySelector('input, textarea, select')
                ) {
                  relevantChange = true;
                  break;
                }
              }
            }
          }
          if (relevantChange) break;
        }

        if (relevantChange) {
          this._scheduleRescan();
        }
      });

      this._observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    _scheduleRescan() {
      if (this._debounceTimeout) {
        clearTimeout(this._debounceTimeout);
      }

      this._debounceTimeout = setTimeout(() => {
        if (typeof this._rescanCallback === 'function') {
          this._rescanCallback();
        }
      }, this._debounceMs);
    }

    stop() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      if (this._debounceTimeout) {
        clearTimeout(this._debounceTimeout);
        this._debounceTimeout = null;
      }
    }
  }

  const dynamicObserver = new DynamicFormObserver();

  // ─── Module: content/autofillEngine.js ───
  function executeAutofill(matchingResults, options = {}) {
    if (!Array.isArray(matchingResults)) {
      return {
        success: false,
        error: 'Invalid matching results payload: expected an array of results.',
        stats: fieldState.getStats(),
      };
    }

    if (options.clearPrevious !== false) {
      clearAllHighlights();
    }

    fieldState.setMatchingResults(matchingResults);

    let filledCount = 0;
    const processedFields = [];

    for (const match of matchingResults) {
      const { fieldId, status, value, confidence } = match;
      const element = fieldIdentifier.getElement(fieldId);

      if (!element) {
        console.warn(`FillX: Element with fieldId "${fieldId}" was not found in DOM.`);
        continue;
      }

      processedFields.push({ fieldId, element, status, value });

      switch (status) {
        case MATCH_STATUS.MATCHED: {
          if (value !== null && value !== undefined) {
            setFieldValue(element, value);
            filledCount += 1;
          }
          highlightMatched(element, {
            label: confidence ? `✓ ${(confidence * 100).toFixed(0)}%` : '✓ Matched',
          });
          break;
        }

        case MATCH_STATUS.AMBIGUOUS: {
          if (value !== null && value !== undefined && value !== '') {
            setFieldValue(element, value);
            filledCount += 1;
          }
          highlightAmbiguous(element, {
            label: '⚠ Review',
          });
          break;
        }

        case MATCH_STATUS.NO_MATCH:
        default: {
          highlightUnmatched(element, {
            label: '✕ Unmatched',
          });
          break;
        }
      }
    }

    const allDetected = fieldState.detectedFields;
    for (const field of allDetected) {
      const isProcessed = processedFields.some((p) => p.fieldId === field.fieldId);
      if (!isProcessed) {
        const element = fieldIdentifier.getElement(field.fieldId);
        if (element) {
          highlightUnmatched(element, { label: '✕ Unmatched' });
        }
      }
    }

    const unmatchedForPrompt = fieldState.getUnmatchedFieldsForPrompt();
    attachSavePromptsToUnmatched(unmatchedForPrompt);

    const stats = fieldState.getStats();

    return {
      success: true,
      filledCount,
      stats,
      processedCount: processedFields.length,
    };
  }

  // ─── Module: content/contentScript.js ───
  injectHighlighterStyles();

  function handleScanPage() {
    const fields = detectFormFields(document);
    fieldState.setDetectedFields(fields);
    const stats = fieldState.getStats();

    return {
      fields,
      stats,
    };
  }

  function handleAutofillPage(results) {
    if (fieldState.detectedFields.length === 0) {
      handleScanPage();
    }
    const outcome = executeAutofill(results);
    return outcome;
  }

  function handleClearHighlights() {
    clearAllHighlights();
    return {
      success: true,
      stats: fieldState.getStats(),
    };
  }

  dynamicObserver.start(() => {
    const previousCount = fieldState.detectedFields.length;
    const { fields, stats } = handleScanPage();

    if (fields.length !== previousCount) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.RESCAN_PAGE,
          payload: { fields, stats },
        }).catch(() => {});
      }
    }
  });

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
      setFieldValue,
      highlightMatched,
      highlightAmbiguous,
      highlightUnmatched,
    };
  }
})();
