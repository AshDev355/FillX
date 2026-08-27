/**
 * fieldIdentifier.js — Reliable DOM Element <-> fieldId mapping
 *
 * Assigns deterministic unique identifiers to DOM elements and maintains
 * lookup registries so matching results accurately target the right inputs.
 */

class FieldIdentifierRegistry {
  constructor() {
    this._idToElement = new Map();
    this._elementToId = new WeakMap();
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
   *
   * @param {HTMLElement} element
   * @returns {string}
   */
  generateFieldId(element) {
    const existingId = element.getAttribute('data-fillx-id');
    if (existingId && this._idToElement.has(existingId)) {
      return existingId;
    }

    const tagName = (element.tagName || 'input').toLowerCase();
    const type = (
      element.getAttribute('type') ||
      (tagName === 'textarea' ? 'textarea' : tagName === 'select' ? 'select' : 'text')
    ).toLowerCase();
    const nameOrId = (element.name || element.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);

    this._counter += 1;
    const base = nameOrId ? `${nameOrId}_${type}` : `${type}`;
    return `field_${this._counter}_${base}`;
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

    const existingId = this._elementToId.get(element);
    if (existingId && this._idToElement.get(existingId) === element) {
      return existingId;
    }

    const fieldId = customId || this.generateFieldId(element);
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
    // Fallback search in document
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
