/**
 * dynamicObserver.js — MutationObserver for Dynamic Forms & SPAs
 *
 * Automatically detects when new form fields are added to the DOM after initial load
 * (e.g. multi-step wizards, accordion expands, dynamic field builders) and triggers
 * a debounced rescan without causing performance overhead or recursive loops.
 */

class DynamicFormObserver {
  constructor() {
    this._observer = null;
    this._rescanCallback = null;
    this._debounceTimeout = null;
    this._debounceMs = 400;
  }

  /**
   * Starts observing the DOM for newly inserted form controls.
   *
   * @param {Function} onNewFieldsDetected - Callback triggered when new fields appear
   */
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
              // Ignore our own injected badges or prompts
              if (
                node.classList?.contains('fillx-badge-container') ||
                node.classList?.contains('fillx-save-prompt') ||
                node.id === 'fillx-highlighter-styles'
              ) {
                continue;
              }

              // Check if node is or contains an input/textarea/select
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

  /**
   * Debounces the rescan call to avoid performance spikes.
   */
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

  /**
   * Stops observing the DOM.
   */
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

export const dynamicObserver = new DynamicFormObserver();
