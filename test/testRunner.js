/**
 * testRunner.js — Automated Functional Test Suite & Interactive Controller
 */

import { MOCK_USER_PROFILE } from './mockData.js';

const btnRunTests = document.getElementById('btn-run-tests');
const btnAutofill = document.getElementById('btn-autofill-mock');
const btnScan = document.getElementById('btn-scan-harness');
const btnClear = document.getElementById('btn-clear-harness');
const btnAddDynamic = document.getElementById('btn-add-dynamic');

const totalCountEl = document.getElementById('harness-total-count');
const attentionCountEl = document.getElementById('harness-attention-count');
const resultsPanel = document.getElementById('test-results-panel');
const testSummaryEl = document.getElementById('test-summary');
const testLogEl = document.getElementById('test-log');

let dynamicFieldCount = 0;

function updateHarnessStats(stats) {
  if (!stats) return;
  totalCountEl.textContent = stats.totalFields ?? 0;
  attentionCountEl.textContent = stats.fieldsNeedAttention ?? 0;
}

function logTestResult(name, passed, details = '') {
  const line = document.createElement('div');
  line.className = passed ? 'test-pass' : 'test-fail';
  line.textContent = `${passed ? '✓ PASS' : '✗ FAIL'}: ${name}${details ? ` — ${details}` : ''}`;
  testLogEl.appendChild(line);
}

function logInfo(msg) {
  const line = document.createElement('div');
  line.className = 'test-info';
  line.textContent = `ℹ ${msg}`;
  testLogEl.appendChild(line);
}

export async function runAutomatedTests() {
  resultsPanel.style.display = 'block';
  testLogEl.innerHTML = '';
  testSummaryEl.textContent = 'Running FillX Test Suite...';

  const engine = window.__FILLX_CONTENT_SCRIPT__;
  if (!engine) {
    logTestResult('Content Script Initialization', false, 'window.__FILLX_CONTENT_SCRIPT__ not found.');
    return;
  }

  let passedTests = 0;
  let totalTests = 0;

  function assert(name, condition, details = '') {
    totalTests += 1;
    if (condition) {
      passedTests += 1;
      logTestResult(name, true, details);
    } else {
      logTestResult(name, false, details);
    }
  }

  logInfo('Step 1: Form Field Detection Verification');

  // Test 1: Field Detection
  const scanResult = engine.handleScanPage();
  const fields = scanResult.fields;
  assert('Field Detection: Finds form fields', fields.length >= 10, `Found ${fields.length} fillable fields`);

  const hasFirstName = fields.some((f) => f.name === 'first_name' && f.label.toLowerCase().includes('first name'));
  assert('Field Detection: Correct label resolution for first_name', hasFirstName, 'Resolved label correctly');

  const hasEmail = fields.some((f) => f.type === 'email');
  assert('Field Detection: Detects input[type=email]', hasEmail);

  const hasSelect = fields.some((f) => f.tagName === 'SELECT' && Array.isArray(f.options) && f.options.length > 0);
  assert('Field Detection: Detects SELECT and extracts options', hasSelect);

  const hasTextarea = fields.some((f) => f.tagName === 'TEXTAREA');
  assert('Field Detection: Detects TEXTAREA fields', hasTextarea);

  logInfo('Step 2: Unique Field Identification & DOM Lookup');

  // Test 2: Field Identification & Caching
  const firstField = fields[0];
  const domElement = engine.fieldIdentifier.getElement(firstField.fieldId);
  assert('Field Identifier: Retrieves DOM element by unique fieldId', Boolean(domElement), `Matched fieldId ${firstField.fieldId}`);

  const reverseFieldId = engine.fieldIdentifier.getFieldId(domElement);
  assert('Field Identifier: Reverse lookup from element to fieldId', reverseFieldId === firstField.fieldId);

  logInfo('Step 3: Framework-Aware Value Setting');

  // Test 3: Framework Value Setters & Reactive Events
  const reactInput = document.getElementById('react_company');
  engine.setFieldValue(reactInput, 'Acme Software Corp');
  assert('React Controlled Input: Value injected', reactInput.value === 'Acme Software Corp');

  const reactStateDisplay = document.getElementById('react_state_display');
  assert('React Controlled Input: Dispatched input event triggers state update', reactStateDisplay.textContent.includes('Acme Software Corp'));

  const vueInput = document.getElementById('vue_job_title');
  engine.setFieldValue(vueInput, 'Senior Frontend Developer');
  assert('Vue Reactive Input: Value injected', vueInput.value === 'Senior Frontend Developer');

  const vueStateDisplay = document.getElementById('vue_state_display');
  assert('Vue Reactive Input: Dispatched event triggers state update', vueStateDisplay.textContent.includes('Senior Frontend Developer'));

  // Test 4: Select Dropdown Value Setter
  const selectEl = document.getElementById('country_select');
  engine.setFieldValue(selectEl, 'United States');
  assert('Select Value Setter: Selects matching dropdown option', selectEl.value === 'United States');

  logInfo('Step 4: Autofill Engine Execution & Matching States');

  // Test 5: Autofill Execution with Mock Matching Results
  const mockMatching = fields.map((f) => {
    const clues = `${f.name} ${f.label} ${f.placeholder}`.toLowerCase();
    if (clues.includes('first name') || clues.includes('first_name')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'John', confidence: 0.98 };
    }
    if (clues.includes('last name') || clues.includes('last_name')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Doe', confidence: 0.98 };
    }
    if (clues.includes('email')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'john.doe@example.com', confidence: 0.99 };
    }
    if (clues.includes('phone')) {
      return { fieldId: f.fieldId, status: 'matched', value: '+1 (555) 234-5678', confidence: 0.95 };
    }
    if (clues.includes('street')) {
      return { fieldId: f.fieldId, status: 'matched', value: '742 Evergreen Terrace', confidence: 0.92 };
    }
    if (clues.includes('city')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Springfield', confidence: 0.94 };
    }
    if (clues.includes('country')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'United States', confidence: 0.96 };
    }
    if (clues.includes('notes') || clues.includes('why us')) {
      return { fieldId: f.fieldId, status: 'ambiguous', value: 'Experienced engineer interested in this opportunity.', confidence: 0.65, isOpenEnded: true };
    }
    if (clues.includes('clearance')) {
      return { fieldId: f.fieldId, status: 'no_match', value: null, confidence: 0 };
    }
    return { fieldId: f.fieldId, status: 'no_match', value: null, confidence: 0 };
  });

  const autofillOutcome = engine.handleAutofillPage(mockMatching);
  assert('Autofill Engine: Returns success response', autofillOutcome.success === true);
  assert('Autofill Engine: Filled matched fields', autofillOutcome.filledCount >= 6, `Filled ${autofillOutcome.filledCount} fields`);

  // Safety Assertion: Unmatched field must remain completely blank
  const unmatchedInput = document.getElementById('unmatched_clearance');
  assert('Safety: Unmatched field remains strictly blank', unmatchedInput.value === '', 'Left blank with no invented values');

  logInfo('Step 5: Highlighting & Reversibility');

  // Test 6: Highlighting Applied
  const matchedEl = document.getElementById('first_name');
  assert('Highlighter: Applies fillx-highlight-matched class', matchedEl.classList.contains('fillx-highlight-matched'));

  const ambiguousEl = document.getElementById('ambiguous_notes');
  assert('Highlighter: Applies fillx-highlight-ambiguous class', ambiguousEl.classList.contains('fillx-highlight-ambiguous'));

  const unmatchedEl = document.getElementById('unmatched_clearance');
  assert('Highlighter: Applies fillx-highlight-unmatched class', unmatchedEl.classList.contains('fillx-highlight-unmatched'));

  const badges = document.querySelectorAll('.fillx-badge-container');
  assert('Highlighter: Injected floating status badges', badges.length > 0, `Created ${badges.length} badges`);

  // Test 7: Attention Counter
  const stats = engine.fieldState.getStats();
  const expectedAttention = stats.ambiguousCount + stats.unmatchedCount;
  assert('Attention Counter: Correct calculation (ambiguous + unmatched)', stats.fieldsNeedAttention === expectedAttention, `needsAttention = ${stats.fieldsNeedAttention}`);
  updateHarnessStats(stats);

  // Test 8: Reversible Clear Highlights
  engine.handleClearHighlights();
  const remainingHighlighted = document.querySelectorAll('.fillx-highlight-matched, .fillx-highlight-ambiguous, .fillx-highlight-unmatched');
  const remainingBadges = document.querySelectorAll('.fillx-badge-container');
  assert('Highlighter: Reversible cleanup removes all classes and badges', remainingHighlighted.length === 0 && remainingBadges.length === 0, 'Cleaned all highlights');

  // Summary
  testSummaryEl.textContent = `Test Suite Completed: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(0)}%)`;
  testSummaryEl.style.color = passedTests === totalTests ? 'var(--success)' : 'var(--danger)';
}

// Button Listeners
btnRunTests.addEventListener('click', runAutomatedTests);

btnScan.addEventListener('click', () => {
  const engine = window.__FILLX_CONTENT_SCRIPT__;
  if (!engine) return;
  const { stats } = engine.handleScanPage();
  updateHarnessStats(stats);
});

btnAutofill.addEventListener('click', () => {
  const engine = window.__FILLX_CONTENT_SCRIPT__;
  if (!engine) return;

  const { fields } = engine.handleScanPage();
  const mockMatching = fields.map((f) => {
    const clues = `${f.name} ${f.label} ${f.placeholder}`.toLowerCase();
    if (clues.includes('first name') || clues.includes('first_name')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'John', confidence: 0.98 };
    }
    if (clues.includes('last name') || clues.includes('last_name')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Doe', confidence: 0.98 };
    }
    if (clues.includes('email')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'john.doe@example.com', confidence: 0.99 };
    }
    if (clues.includes('phone')) {
      return { fieldId: f.fieldId, status: 'matched', value: '+1 (555) 234-5678', confidence: 0.95 };
    }
    if (clues.includes('street')) {
      return { fieldId: f.fieldId, status: 'matched', value: '742 Evergreen Terrace', confidence: 0.92 };
    }
    if (clues.includes('city')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Springfield', confidence: 0.94 };
    }
    if (clues.includes('country')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'United States', confidence: 0.96 };
    }
    if (clues.includes('company')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Acme Software Corp', confidence: 0.90 };
    }
    if (clues.includes('job title')) {
      return { fieldId: f.fieldId, status: 'matched', value: 'Senior Frontend Developer', confidence: 0.90 };
    }
    if (clues.includes('notes') || clues.includes('why us')) {
      return { fieldId: f.fieldId, status: 'ambiguous', value: 'Experienced engineer interested in this opportunity.', confidence: 0.65, isOpenEnded: true };
    }
    return { fieldId: f.fieldId, status: 'no_match', value: null, confidence: 0 };
  });

  const outcome = engine.handleAutofillPage(mockMatching);
  updateHarnessStats(outcome.stats);
});

btnClear.addEventListener('click', () => {
  const engine = window.__FILLX_CONTENT_SCRIPT__;
  if (!engine) return;
  const outcome = engine.handleClearHighlights();
  updateHarnessStats(outcome.stats);
});

btnAddDynamic.addEventListener('click', () => {
  dynamicFieldCount += 1;
  const container = document.getElementById('dynamic-fields-container');
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '16px';
  card.innerHTML = `
    <h2>Dynamic Reference Field #${dynamicFieldCount}</h2>
    <div class="form-group">
      <label for="dynamic_ref_${dynamicFieldCount}">Reference Name #${dynamicFieldCount}</label>
      <input type="text" id="dynamic_ref_${dynamicFieldCount}" name="dynamic_ref_${dynamicFieldCount}" placeholder="Reference Full Name">
    </div>
  `;
  container.appendChild(card);
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const engine = window.__FILLX_CONTENT_SCRIPT__;
    if (engine) {
      const { stats } = engine.handleScanPage();
      updateHarnessStats(stats);
    }
  }, 100);
});
