/**
 * dynamicObserver.js — MutationObserver for Dynamic Forms & SPAs
 *
 * Automatically detects when new form fields are added to the DOM after initial load
 * and triggers a debounced rescan without recursion loops or performance overhead.
 * Automatically disconnects if the extension context is invalidated on reload.
 */

function isExtensionValid() {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch (e) {
    return false;
  }
}

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
   * @param {Function} onNewFieldsDetected
   */
  start(onNewFieldsDetected) {
    this._rescanCallback = onNewFieldsDetected;

    if (this._observer) {
      this._observer.disconnect();
    }

    if (!isExtensionValid()) {
      return;
    }

    this._observer = new MutationObserver((mutations) => {
      // If extension was reloaded/invalidated, disconnect immediately
      if (!isExtensionValid()) {
        this.stop();
        return;
      }

      let relevantChange = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Ignore extension's own injected badges or prompts
              if (
                node.classList?.contains('fillx-badge-container') ||
                node.classList?.contains('fillx-save-prompt') ||
                node.classList?.contains('fillx-generate-trigger') ||
                node.id === 'fillx-generate-modal' ||
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

    try {
      this._observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      // Ignored if document is not ready
    }
  }

  _scheduleRescan() {
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    this._debounceTimeout = setTimeout(() => {
      if (!isExtensionValid()) {
        this.stop();
        return;
      }

      if (typeof this._rescanCallback === 'function') {
        try {
          this._rescanCallback();
        } catch (e) {
          if (!isExtensionValid()) this.stop();
        }
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

export const dynamicObserver = new DynamicFormObserver();
