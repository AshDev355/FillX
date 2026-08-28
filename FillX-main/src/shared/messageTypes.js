/**
 * messageTypes.js — Standardized Message Types & Contracts for FillX
 * Shared between Content Scripts, Background Service Worker, and Popup UI.
 */

export const MESSAGE_TYPES = {
  // Page Scanning & Field Detection
  SCAN_PAGE: 'FILLX_SCAN_PAGE',
  SCAN_PAGE_RESPONSE: 'FILLX_SCAN_PAGE_RESPONSE',

  // Autofill Execution
  AUTOFILL_PAGE: 'FILLX_AUTOFILL_PAGE',
  AUTOFILL_PAGE_RESPONSE: 'FILLX_AUTOFILL_PAGE_RESPONSE',

  // State & Attention Queries
  GET_PAGE_STATUS: 'FILLX_GET_PAGE_STATUS',
  GET_PAGE_STATUS_RESPONSE: 'FILLX_GET_PAGE_STATUS_RESPONSE',

  // Highlight Management
  CLEAR_HIGHLIGHTS: 'FILLX_CLEAR_HIGHLIGHTS',
  CLEAR_HIGHLIGHTS_RESPONSE: 'FILLX_CLEAR_HIGHLIGHTS_RESPONSE',

  // Dynamic Form Rescan
  RESCAN_PAGE: 'FILLX_RESCAN_PAGE',

  // Backend Matching Relay (Content/Popup -> Background -> Backend)
  MATCH_FIELDS: 'FILLX_MATCH_FIELDS',
  MATCH_FIELDS_RESPONSE: 'FILLX_MATCH_FIELDS_RESPONSE',

  // Keyword-to-Answer Generator (Open-Ended / Textarea synthesis)
  GENERATE_ANSWER: 'FILLX_GENERATE_ANSWER',
  GENERATE_ANSWER_RESPONSE: 'FILLX_GENERATE_ANSWER_RESPONSE',

  // Document Upload & AI Extraction
  EXTRACT_DOCUMENT: 'FILLX_EXTRACT_DOCUMENT',
  EXTRACT_DOCUMENT_RESPONSE: 'FILLX_EXTRACT_DOCUMENT_RESPONSE',

  // Save Custom Field to Profile
  SAVE_CUSTOM_FIELD: 'SAVE_CUSTOM_FIELD',
  SAVE_UNMATCHED_FIELD: 'SAVE_UNMATCHED_FIELD',
  PROFILE_UPDATED: 'PROFILE_UPDATED',

  // Test Mode
  SET_TEST_MODE: 'FILLX_SET_TEST_MODE',
  GET_TEST_MODE: 'FILLX_GET_TEST_MODE',
};

export const MATCH_STATUS = {
  MATCHED: 'matched',
  AMBIGUOUS: 'ambiguous',
  NO_MATCH: 'no_match',
};

export const FIELD_TYPES = {
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
