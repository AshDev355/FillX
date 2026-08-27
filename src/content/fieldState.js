/**
 * fieldState.js — In-Memory Field State & Attention Counter
 *
 * Maintains the current scanning and autofill state on the webpage:
 * - Scanned fields
 * - Applied matching results
 * - Attention counter calculation (fieldsNeedAttention = ambiguous + unmatched)
 * - Statistics for Popup UI and Background badge updates.
 */

import { fieldIdentifier } from './fieldIdentifier.js';
import { MATCH_STATUS } from '../shared/messageTypes.js';

class FieldStateManager {
  constructor() {
    this.detectedFields = [];
    this.matchingResults = [];
    this.fieldStatusMap = new Map(); // fieldId -> { status, value, confidence, isOpenEnded }
  }

  /**
   * Reset all stored field state.
   */
  reset() {
    this.detectedFields = [];
    this.matchingResults = [];
    this.fieldStatusMap.clear();
  }

  /**
   * Sets the list of detected fields from a fresh scan.
   *
   * @param {Array<object>} fields
   */
  setDetectedFields(fields) {
    this.detectedFields = Array.isArray(fields) ? [...fields] : [];
  }

  /**
   * Records the matching results.
   *
   * @param {Array<object>} results
   */
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

  /**
   * Updates an individual field's status (e.g. after a manual save).
   *
   * @param {string} fieldId
   * @param {string} status
   * @param {any} [value]
   */
  updateFieldStatus(fieldId, status, value = null) {
    if (!fieldId) return;
    this.fieldStatusMap.set(fieldId, {
      status,
      value,
      confidence: status === MATCH_STATUS.MATCHED ? 1.0 : null,
      isOpenEnded: false,
    });
  }

  /**
   * Computes the current statistics and attention count.
   * Attention Rule: fieldsNeedAttention = ambiguous + unmatched
   *
   * @returns {{
   *   totalFields: number,
   *   matchedCount: number,
   *   ambiguousCount: number,
   *   unmatchedCount: number,
   *   fieldsNeedAttention: number
   * }}
   */
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

    // Any detected field that was omitted from matching results is counted as unmatched
    const accountedCount = matchedCount + ambiguousCount + unmatchedCount;
    if (this.detectedFields.length > accountedCount) {
      unmatchedCount += this.detectedFields.length - accountedCount;
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

  /**
   * Returns a list of unmatched field elements and their labels
   * for passing into save prompt listeners.
   *
   * @returns {Array<{ element: HTMLElement, label: string, fieldId: string }>}
   */
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

export const fieldState = new FieldStateManager();
