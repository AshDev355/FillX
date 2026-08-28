/**
 * autofillEngine.js — Core Autofill Orchestration Engine
 *
 * Coordinates:
 * - Matching result execution (matched, ambiguous, no_match)
 * - Safe value injection via valueSetter (React/Vue/native)
 * - Highlighting application (green, amber, red)
 * - Attention counter calculation (fieldsNeedAttention = ambiguous + unmatched)
 * - Save-prompt attachment for unmatched fields
 *
 * Safety Guarantees:
 * - NEVER automatically clicks submit buttons or triggers form submission.
 * - NEVER invents values for unmatched fields.
 * - Fails gracefully if DOM elements are removed or mutated.
 */

import { fieldIdentifier } from './fieldIdentifier.js';
import { setFieldValue } from './valueSetter.js';
import {
  highlightMatched,
  highlightAmbiguous,
  highlightUnmatched,
  clearAllHighlights,
} from './highlighter.js';
import { fieldState } from './fieldState.js';
import { attachSavePromptsToUnmatched } from './savePromptBridge.js';
import { MATCH_STATUS } from '../shared/messageTypes.js';
import { isValidValueForField } from '../shared/fieldValueValidator.js';

/**
 * Executes autofill on the webpage based on the provided matching results.
 *
 * @param {Array<object>} matchingResults - Array of { fieldId, status, value, confidence, isOpenEnded }
 * @param {object} [options]
 * @returns {object}
 */
export function executeAutofill(matchingResults, options = {}) {
  if (!Array.isArray(matchingResults)) {
    return {
      success: false,
      error: 'Invalid matching results payload: expected an array.',
      stats: fieldState.getStats(),
    };
  }

  // Clear previous highlights if requested
  if (options.clearPrevious !== false) {
    clearAllHighlights();
  }

  // Update field state with incoming results
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

    const fieldDescriptor = {
      type: (element.getAttribute('type') || element.tagName || 'text').toLowerCase(),
      label: element.getAttribute('aria-label') || '',
      name: element.getAttribute('name') || '',
      id: element.id || '',
      placeholder: element.getAttribute('placeholder') || '',
      autocomplete: element.getAttribute('autocomplete') || '',
    };
    const valueIsSafe = isValidValueForField(fieldDescriptor, value);

    console.debug('FillX match trace', {
      fieldId,
      label: fieldDescriptor.label,
      name: fieldDescriptor.name,
      id: fieldDescriptor.id,
      type: fieldDescriptor.type,
      profileKey: match.profileKey || null,
      confidence: match.confidence ?? 0,
      status,
      valueIsSafe,
    });

    if ((status === MATCH_STATUS.MATCHED || status === MATCH_STATUS.AMBIGUOUS) && !valueIsSafe) {
      fieldState.updateFieldStatus(fieldId, MATCH_STATUS.NO_MATCH);
      processedFields[processedFields.length - 1].status = MATCH_STATUS.NO_MATCH;
      highlightUnmatched(element, { label: '✕ Unmatched' });
      continue;
    }

    switch (status) {
      case MATCH_STATUS.MATCHED: {
        // Confident match: inject value and highlight green
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
        // Ambiguous match: inject value if provided, highlight amber, needs user review
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
        // Unmatched field: leave strictly blank, highlight dashed red/orange
        highlightUnmatched(element, {
          label: '✕ Unmatched',
        });
        break;
      }
    }
  }

  // Ensure any detected fields omitted from matching results are highlighted as unmatched
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

  // Attach save prompt listeners to unmatched fields
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
