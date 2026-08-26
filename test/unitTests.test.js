/**
 * unitTests.test.js — Automated Node.js Unit Tests for FillX Extension Core
 *
 * Runs headless verification using Node's built-in test runner:
 * node test/unitTests.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_TYPES, MATCH_STATUS, FIELD_TYPES } from '../src/shared/messageTypes.js';
import { generateLocalMockMatches } from '../src/background/serviceWorker.js';
import { normalizeLabel } from '../src/content/savePromptBridge.js';
import { MOCK_USER_PROFILE } from './mockData.js';

test('FillX Message Types & Contracts', () => {
  assert.equal(MESSAGE_TYPES.SCAN_PAGE, 'FILLX_SCAN_PAGE');
  assert.equal(MESSAGE_TYPES.AUTOFILL_PAGE, 'FILLX_AUTOFILL_PAGE');
  assert.equal(MESSAGE_TYPES.GET_PAGE_STATUS, 'FILLX_GET_PAGE_STATUS');
  assert.equal(MESSAGE_TYPES.CLEAR_HIGHLIGHTS, 'FILLX_CLEAR_HIGHLIGHTS');
  assert.equal(MESSAGE_TYPES.SAVE_CUSTOM_FIELD, 'SAVE_CUSTOM_FIELD');

  assert.equal(MATCH_STATUS.MATCHED, 'matched');
  assert.equal(MATCH_STATUS.AMBIGUOUS, 'ambiguous');
  assert.equal(MATCH_STATUS.NO_MATCH, 'no_match');
});

test('SavePromptBridge: normalizeLabel', () => {
  assert.equal(normalizeLabel('Full Name'), 'full_name');
  assert.equal(normalizeLabel('Desired Salary ($)'), 'desired_salary');
  assert.equal(normalizeLabel('  Email Address!  '), 'email_address');
  assert.equal(normalizeLabel('Years of Experience (1-10)'), 'years_of_experience_110');
});

test('Background Service Worker: generateLocalMockMatches', () => {
  const fields = [
    {
      fieldId: 'f1',
      name: 'first_name',
      label: 'First Name',
      type: 'text',
      tagName: 'INPUT',
    },
    {
      fieldId: 'f2',
      name: 'email',
      label: 'Email Address',
      type: 'email',
      tagName: 'INPUT',
    },
    {
      fieldId: 'f3',
      name: 'phone',
      label: 'Phone Number',
      type: 'tel',
      tagName: 'INPUT',
    },
    {
      fieldId: 'f4',
      name: 'city',
      label: 'City',
      type: 'text',
      tagName: 'INPUT',
    },
    {
      fieldId: 'f5',
      name: 'unknown_clearance',
      label: 'Security Clearance (Not in Profile)',
      type: 'text',
      tagName: 'INPUT',
    },
  ];

  const results = generateLocalMockMatches(fields, MOCK_USER_PROFILE);

  assert.equal(results.length, 5);

  const f1 = results.find((r) => r.fieldId === 'f1');
  assert.equal(f1.status, 'matched');
  assert.equal(f1.value, 'John');

  const f2 = results.find((r) => r.fieldId === 'f2');
  assert.equal(f2.status, 'matched');
  assert.equal(f2.value, 'john.doe@example.com');

  const f3 = results.find((r) => r.fieldId === 'f3');
  assert.equal(f3.status, 'matched');
  assert.equal(f3.value, '+1 (555) 234-5678');

  const f4 = results.find((r) => r.fieldId === 'f4');
  assert.equal(f4.status, 'matched');
  assert.equal(f4.value, 'Springfield');

  const f5 = results.find((r) => r.fieldId === 'f5');
  assert.equal(f5.status, 'no_match');
  assert.equal(f5.value, null);
});

test('Attention Counter Rule: fieldsNeedAttention = ambiguous + unmatched', () => {
  const mockResults = [
    { fieldId: 'f1', status: 'matched', value: 'John' },
    { fieldId: 'f2', status: 'matched', value: 'Doe' },
    { fieldId: 'f3', status: 'ambiguous', value: 'Maybe' },
    { fieldId: 'f4', status: 'no_match', value: null },
    { fieldId: 'f5', status: 'no_match', value: null },
  ];

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  for (const r of mockResults) {
    if (r.status === 'matched') matched++;
    else if (r.status === 'ambiguous') ambiguous++;
    else unmatched++;
  }

  const fieldsNeedAttention = ambiguous + unmatched;

  assert.equal(matched, 2);
  assert.equal(ambiguous, 1);
  assert.equal(unmatched, 2);
  assert.equal(fieldsNeedAttention, 3);
});
