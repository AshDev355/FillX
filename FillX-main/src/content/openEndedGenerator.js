/**
 * openEndedGenerator.js — Keyword-to-Answer Generator for Essay/Open-Ended Questions
 *
 * 1. Detects open-ended / essay-style form fields (textareas, "why", "describe", "tell us about").
 * 2. Injects a stylish "✨ Generate answer" trigger adjacent to the field.
 * 3. Shows a keyword prompt modal on click.
 * 4. Calls background service worker (/api/generate route or local fallback) and injects the AI paragraph.
 */

import { fieldIdentifier } from './fieldIdentifier.js';
import { setFieldValue } from './valueSetter.js';
import { highlightMatched } from './highlighter.js';
import { MESSAGE_TYPES } from '../shared/messageTypes.js';
import { generateLocalAnswer } from '../shared/answerGenerator.js';

const TRIGGER_CLASS = 'fillx-generate-trigger';
const MODAL_ID = 'fillx-generate-modal';
const ATTACHED_ATTR = 'data-fillx-generator-attached';

/**
 * Checks if a field descriptor is an open-ended / essay-style field.
 *
 * @param {object} field
 * @returns {boolean}
 */
export function isOpenEndedField(field) {
  if (!field) return false;
  if (field.isOpenEnded) return true;

  const isTextarea = field.tagName === 'TEXTAREA';
  const text = `${field.label || ''} ${field.placeholder || ''} ${field.name || ''} ${field.ariaLabel || ''}`.toLowerCase();

  const openEndedPhrases = [
    'why',
    'describe',
    'tell us about',
    'cover letter',
    'statement of purpose',
    'additional information',
    'background',
    'interest in',
    'summary',
    'essay',
    'motivation',
  ];

  const matchesPhrase = openEndedPhrases.some((phrase) => text.includes(phrase));
  return isTextarea || matchesPhrase;
}

function injectGeneratorStyles() {
  if (document.getElementById('fillx-generator-styles')) return;

  const style = document.createElement('style');
  style.id = 'fillx-generator-styles';
  style.textContent = `
    .${TRIGGER_CLASS} {
      position: absolute;
      z-index: 999980;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 4px 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .${TRIGGER_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.45);
    }
    #${MODAL_ID} {
      position: absolute;
      z-index: 999999;
      background: #0f172a;
      border: 1px solid #6366f1;
      border-radius: 8px;
      padding: 14px;
      width: 320px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f8fafc;
      animation: fillx-modal-pop 0.2s ease-out;
    }
    #${MODAL_ID} h4 {
      margin: 0 0 6px 0;
      font-size: 13px;
      color: #a5b4fc;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #${MODAL_ID} p {
      margin: 0 0 10px 0;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }
    #${MODAL_ID} input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #f8fafc;
      font-size: 12px;
      padding: 8px 10px;
      margin-bottom: 10px;
      outline: none;
    }
    #${MODAL_ID} input[type="text"]:focus {
      border-color: #6366f1;
    }
    .fillx-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .fillx-modal-btn {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .fillx-modal-generate {
      background: #6366f1;
      color: white;
    }
    .fillx-modal-generate:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .fillx-modal-cancel {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    .fillx-modal-cancel:hover { color: #f87171; }
    @keyframes fillx-modal-pop {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function removeModal() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showKeywordModal(element, question, fieldId) {
  removeModal();
  injectGeneratorStyles();

  const modal = document.createElement('div');
  modal.id = MODAL_ID;

  modal.innerHTML = `
    <h4>✨ AI Answer Generator</h4>
    <p>Enter 2-3 keywords to highlight for: "<em>${escapeHtml(question)}</em>"</p>
    <input type="text" id="fillx-kw-input" placeholder="e.g. leadership, React, problem solving" autofocus />
    <div class="fillx-modal-actions">
      <button class="fillx-modal-btn fillx-modal-cancel">Cancel</button>
      <button class="fillx-modal-btn fillx-modal-generate">Generate Answer</button>
    </div>
  `;

  const rect = element.getBoundingClientRect();
  modal.style.top = `${rect.bottom + window.scrollY + 6}px`;
  modal.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;

  document.body.appendChild(modal);

  const inputEl = modal.querySelector('#fillx-kw-input');
  const genBtn = modal.querySelector('.fillx-modal-generate');
  const cancelBtn = modal.querySelector('.fillx-modal-cancel');

  cancelBtn.addEventListener('click', removeModal);

  async function handleGenerate() {
    const keywords = inputEl.value.trim();
    if (!keywords) {
      inputEl.focus();
      return;
    }

    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';

    let messageSent = false;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
        messageSent = true;
        chrome.runtime.sendMessage(
          {
            type: MESSAGE_TYPES.GENERATE_ANSWER,
            payload: {
              question,
              keywords,
              fieldId,
            },
          },
          (response) => {
            if (chrome.runtime?.lastError) {
              // Fallback to local synthesizer
              applyFallback();
              return;
            }

            if (response?.success && response.answer) {
              setFieldValue(element, response.answer);
              highlightMatched(element, { label: '✓ Generated' });
            } else {
              applyFallback();
            }
            removeModal();
          }
        );
      }
    } catch (e) {
      applyFallback();
    }

    function applyFallback() {
      const fallbackAnswer = generateLocalAnswer(question, keywords);
      setFieldValue(element, fallbackAnswer);
      highlightMatched(element, { label: '✓ Generated' });
      removeModal();
    }

    if (!messageSent) {
      applyFallback();
    }
  }

  genBtn.addEventListener('click', handleGenerate);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGenerate();
    if (e.key === 'Escape') removeModal();
  });
}

/**
 * Injects "✨ Generate answer" buttons adjacent to open-ended fields.
 *
 * @param {Array<object>} fields
 */
export function attachGenerateAnswerButtons(fields) {
  if (!Array.isArray(fields)) return;
  injectGeneratorStyles();

  for (const field of fields) {
    if (!isOpenEndedField(field)) continue;

    const element = fieldIdentifier.getElement(field.fieldId);
    if (!element || element.getAttribute(ATTACHED_ATTR)) continue;

    const trigger = document.createElement('button');
    trigger.className = TRIGGER_CLASS;
    trigger.innerHTML = '✨ Generate answer';
    trigger.setAttribute('type', 'button');

    const rect = element.getBoundingClientRect();
    trigger.style.top = `${rect.top + window.scrollY - 24}px`;
    trigger.style.left = `${Math.max(0, rect.right + window.scrollX - 130)}px`;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const questionText = field.label || field.placeholder || field.name || 'Why are you a good fit?';
      showKeywordModal(element, questionText, field.fieldId);
    });

    document.body.appendChild(trigger);
    element.setAttribute(ATTACHED_ATTR, 'true');
  }
}

export function removeGenerateAnswerButtons() {
  document.querySelectorAll(`.${TRIGGER_CLASS}`).forEach((btn) => btn.remove());
  removeModal();
}
