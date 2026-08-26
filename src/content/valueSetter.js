/**
 * valueSetter.js — Framework-Aware Value Setting & Event Dispatcher
 *
 * Implements reliable value injection for:
 * - Native HTML form elements
 * - React 15 / 16 / 17 / 18 / 19 controlled inputs (bypassing _valueTracker)
 * - Vue 2 / Vue 3 v-model reactive inputs
 * - Angular and other modern reactive frameworks
 *
 * Dispatches proper synthetic events (focus, input, change, blur) to ensure
 * framework state updates, validation rules re-evaluate, and forms reflect values.
 */

/**
 * Safely sets the value of an <input> element across React, Vue, and native DOM.
 *
 * @param {HTMLInputElement} inputEl
 * @param {string|number|boolean} value
 */
function setInputValue(inputEl, value) {
  const stringVal = value !== null && value !== undefined ? String(value) : '';
  const previousValue = inputEl.value;

  // React 16+ overrides the value setter on HTMLInputElement.prototype.
  // We retrieve the native prototype setter from the standard prototype chain.
  const prototype = Object.getPrototypeOf(inputEl);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') ||
                     Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(inputEl, stringVal);
  } else {
    inputEl.value = stringVal;
  }

  // React's _valueTracker tracks previous value to deduce changes on input event
  if (inputEl._valueTracker) {
    inputEl._valueTracker.setValue(previousValue);
  }
}

/**
 * Safely sets the value of a <textarea> element across React, Vue, and native DOM.
 *
 * @param {HTMLTextAreaElement} textareaEl
 * @param {string} value
 */
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

/**
 * Safely selects an option on a <select> element.
 * Tries matching by option value first, then text content, then case-insensitive partial match.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {string} value
 * @returns {boolean} True if matching option was found and selected
 */
function setSelectValue(selectEl, value) {
  if (!selectEl || !value) return false;

  const target = String(value).trim().toLowerCase();
  let matchedIndex = -1;

  // Pass 1: exact value match
  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    if (opt.value.trim().toLowerCase() === target) {
      matchedIndex = i;
      break;
    }
  }

  // Pass 2: exact textContent match
  if (matchedIndex === -1) {
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      if (opt.textContent.trim().toLowerCase() === target) {
        matchedIndex = i;
        break;
      }
    }
  }

  // Pass 3: substring / partial match
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

/**
 * Safely sets the checked state of a checkbox or radio button.
 *
 * @param {HTMLInputElement} inputEl
 * @param {boolean|string} checkedState
 */
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

/**
 * Dispatches a full sequence of DOM events (focus, input, change, blur)
 * to ensure all listeners and framework state bindings trigger correctly.
 *
 * @param {HTMLElement} element
 */
export function dispatchFormEvents(element) {
  if (!element || !(element instanceof HTMLElement)) return;

  // 1. Focus event
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: true }));

  // 2. Input event (crucial for React, Vue, Angular reactive bindings)
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertReplacementText',
  });
  element.dispatchEvent(inputEvent);

  // 3. Change event (crucial for selects, checkboxes, form validation)
  const changeEvent = new Event('change', {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(changeEvent);

  // 4. Blur event
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
}

/**
 * Master value setting function.
 * Determines the element type and applies the value with framework compatibility.
 *
 * @param {HTMLElement} element
 * @param {any} value
 * @returns {{ success: boolean, previousValue: any, newValue: any }}
 */
export function setFieldValue(element, value) {
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
