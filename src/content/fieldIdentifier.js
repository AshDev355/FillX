/**
 * fieldIdentifier.js — Reliable DOM Element <-> fieldId mapping
 *
 * Ensures each detected form element has a unique, collision-resistant fieldId,
 * and maintains a bidirectional lookup cache so matching results accurately
 * target the exact DOM element.
 */

class FieldIdentifierRegistry {
  constructor() {
    // Map: fieldId -> HTMLElement
    this._idToElement = new Map();
    // WeakMap: HTMLElement -> fieldId
    this._elementToId = new WeakMap();
    // Counter for generating unique sequential IDs
    this._counter = 0;
  }

  /**
   * Reset registry mappings.
   */
  clear() {
    this._idToElement.clear();
    this._counter = 0;
  }

  /**
   * Generates a stable unique field identifier for an element.
   * Format: f_{index}_{name/id/type}_{hash}
   *
   * @param {HTMLElement} element
   * @param {number} index
   * @returns {string} Unique fieldId
   */
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

  /**
   * Registers a DOM element and associates it with a unique fieldId.
   *
   * @param {HTMLElement} element
   * @param {string} [customId]
   * @returns {string} Assigned fieldId
   */
  register(element, customId = null) {
    if (!element || !(element instanceof HTMLElement)) {
      return null;
    }

    // Check if element is already registered
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

  /**
   * Retrieves the DOM element associated with a given fieldId.
   *
   * @param {string} fieldId
   * @returns {HTMLElement|null}
   */
  getElement(fieldId) {
    if (!fieldId) return null;
    const element = this._idToElement.get(fieldId);
    if (element && document.contains(element)) {
      return element;
    }
    // Fallback: check DOM query if element was re-rendered with the attribute
    const found = document.querySelector(`[data-fillx-id="${CSS.escape(fieldId)}"]`);
    if (found) {
      this._idToElement.set(fieldId, found);
      this._elementToId.set(found, fieldId);
      return found;
    }
    return null;
  }

  /**
   * Retrieves the fieldId associated with a given DOM element.
   *
   * @param {HTMLElement} element
   * @returns {string|null}
   */
  getFieldId(element) {
    if (!element || !(element instanceof HTMLElement)) return null;
    return this._elementToId.get(element) || element.getAttribute('data-fillx-id') || null;
  }

  /**
   * Returns all currently registered valid DOM elements.
   *
   * @returns {Array<{ fieldId: string, element: HTMLElement }>}
   */
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

export const fieldIdentifier = new FieldIdentifierRegistry();
