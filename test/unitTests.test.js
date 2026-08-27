/**
 * unitTests.test.js — Comprehensive Automated Tests for FillX
 * Verifies:
 *   1. Message Types & Communication Contracts
 *   2. Save Prompt Bridge: normalizeLabel
 *   3. Matching Heuristics: Weighted Canonical Profile Matching
 *   4. Open-Ended / Essay Field Detection
 *   5. Attention Counter Rule
 *   6. Multi-Account Creation & Database Isolation (No Email Verification)
 *   7. Account Switching & Profile Segregation
 *   8. PDF & DOCX Document Extraction Accuracy
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_TYPES, MATCH_STATUS } from '../src/shared/messageTypes.js';
import { matchFieldsWithHeuristics, isOpenEndedFieldDescriptor } from '../src/utils/matchingHeuristics.js';
import { normalizeLabel } from '../src/content/savePromptBridge.js';
import { localRuleBasedExtractor } from '../src/utils/documentParser.js';
import { signUp, signIn, signOut, getAuthSession } from '../src/utils/auth.js';
import { getProfile, setProfile, getRegisteredUsers, clearActiveProfile } from '../src/utils/storage.js';
import { MOCK_USER_PROFILE } from './mockData.js';

test('1. Message Types & Communication Contracts', () => {
  assert.equal(MESSAGE_TYPES.SCAN_PAGE, 'FILLX_SCAN_PAGE');
  assert.equal(MESSAGE_TYPES.AUTOFILL_PAGE, 'FILLX_AUTOFILL_PAGE');
  assert.equal(MESSAGE_TYPES.GET_PAGE_STATUS, 'FILLX_GET_PAGE_STATUS');
  assert.equal(MESSAGE_TYPES.CLEAR_HIGHLIGHTS, 'FILLX_CLEAR_HIGHLIGHTS');
  assert.equal(MESSAGE_TYPES.GENERATE_ANSWER, 'FILLX_GENERATE_ANSWER');
  assert.equal(MESSAGE_TYPES.EXTRACT_DOCUMENT, 'FILLX_EXTRACT_DOCUMENT');
  assert.equal(MESSAGE_TYPES.SAVE_CUSTOM_FIELD, 'SAVE_CUSTOM_FIELD');

  assert.equal(MATCH_STATUS.MATCHED, 'matched');
  assert.equal(MATCH_STATUS.AMBIGUOUS, 'ambiguous');
  assert.equal(MATCH_STATUS.NO_MATCH, 'no_match');
});

test('2. Save Prompt Bridge: normalizeLabel', () => {
  assert.equal(normalizeLabel('Full Name'), 'full_name');
  assert.equal(normalizeLabel('Desired Salary ($)'), 'desired_salary');
  assert.equal(normalizeLabel('  Email Address!  '), 'email_address');
  assert.equal(normalizeLabel('Years of Experience (1-10)'), 'years_of_experience_110');
});

test('3. Matching Heuristics: Canonical Profile Match Verification', () => {
  const fields = [
    { fieldId: 'f1', name: 'first_name', label: 'First Name', type: 'text', tagName: 'INPUT' },
    { fieldId: 'f2', name: 'user_email', label: 'Email Address', type: 'email', tagName: 'INPUT' },
    { fieldId: 'f3', name: 'mobile_phone', label: 'Phone Number', type: 'tel', tagName: 'INPUT' },
    { fieldId: 'f4', name: 'city_loc', label: 'City', type: 'text', tagName: 'INPUT' },
    { fieldId: 'f5', name: 'salary_req', label: 'Desired Salary', type: 'text', tagName: 'INPUT' },
    { fieldId: 'f6', name: 'clearance_code', label: 'Security Clearance', type: 'text', tagName: 'INPUT' },
  ];

  const results = matchFieldsWithHeuristics(fields, MOCK_USER_PROFILE);
  assert.equal(results.length, 6);

  const f1 = results.find((r) => r.fieldId === 'f1');
  assert.equal(f1.status, MATCH_STATUS.MATCHED);
  assert.equal(f1.value, 'John');

  const f2 = results.find((r) => r.fieldId === 'f2');
  assert.equal(f2.status, MATCH_STATUS.MATCHED);
  assert.equal(f2.value, 'john.doe@example.com');

  const f3 = results.find((r) => r.fieldId === 'f3');
  assert.equal(f3.status, MATCH_STATUS.MATCHED);
  assert.equal(f3.value, '+1 (555) 234-5678');

  const f6 = results.find((r) => r.fieldId === 'f6');
  assert.equal(f6.status, MATCH_STATUS.NO_MATCH);
  assert.equal(f6.value, null);
});

test('4. Open-Ended / Essay Field Detection', () => {
  const textareaField = { tagName: 'TEXTAREA', label: 'Summary', name: 'bio' };
  assert.equal(isOpenEndedFieldDescriptor(textareaField), true);

  const essayInput = { tagName: 'INPUT', label: 'Why are you interested in this position?' };
  assert.equal(isOpenEndedFieldDescriptor(essayInput), true);

  const regularInput = { tagName: 'INPUT', label: 'Zip Code', name: 'zip' };
  assert.equal(isOpenEndedFieldDescriptor(regularInput), false);
});

test('5. Multi-Account Creation & Database Isolation (No Email Verification)', async () => {
  // Create Account 1
  const resA = await signUp('user_a@enterprise.com', 'password123', 'Alice Archer');
  assert.equal(resA.success, true);
  assert.equal(resA.session.isAuthenticated, true);
  assert.equal(resA.session.user.email, 'user_a@enterprise.com');

  // Set Alice's profile
  await setProfile({
    personal: { firstName: 'Alice', lastName: 'Archer', email: 'user_a@enterprise.com', phone: '111-222-3333' },
    address: { city: 'New York', state: 'NY' },
  }, null, 'user_a@enterprise.com');

  // Sign out Alice
  await signOut();
  const sessionAfterSignOut = await getAuthSession();
  assert.equal(sessionAfterSignOut.isAuthenticated, false);

  // Create Account 2
  const resB = await signUp('user_b@startup.io', 'securePass456', 'Bob Builder');
  assert.equal(resB.success, true);
  assert.equal(resB.session.isAuthenticated, true);
  assert.equal(resB.session.user.email, 'user_b@startup.io');

  // Set Bob's profile
  await setProfile({
    personal: { firstName: 'Bob', lastName: 'Builder', email: 'user_b@startup.io', phone: '444-555-6666' },
    address: { city: 'Austin', state: 'TX' },
  }, null, 'user_b@startup.io');

  // Verify both accounts exist in the database registry
  const users = await getRegisteredUsers();
  assert.ok(users['user_a@enterprise.com']);
  assert.ok(users['user_b@startup.io']);
  assert.equal(users['user_a@enterprise.com'].name, 'Alice Archer');
  assert.equal(users['user_b@startup.io'].name, 'Bob Builder');

  // Verify Bob's profile does NOT have Alice's data
  const bobProfile = await getProfile('user_b@startup.io');
  assert.equal(bobProfile.personal.firstName, 'Bob');
  assert.equal(bobProfile.personal.email, 'user_b@startup.io');
  assert.equal(bobProfile.address.city, 'Austin');

  // Switch back to Alice and verify Alice's data is intact
  await signOut();
  const loginAlice = await signIn('user_a@enterprise.com', 'password123');
  assert.equal(loginAlice.success, true);
  const aliceProfile = await getProfile('user_a@enterprise.com');
  assert.equal(aliceProfile.personal.firstName, 'Alice');
  assert.equal(aliceProfile.personal.email, 'user_a@enterprise.com');
  assert.equal(aliceProfile.address.city, 'New York');
});

test('6. PDF & Text Ingestion and Accurate Field Extraction', () => {
  const completeResumeText = `
    Elena Rostova
    Email: elena.rostova@cloudscale.net
    Phone: +1 (555) 789-0123
    DOB: 1993-08-24
    Nationality: United States

    742 Evergreen Terrace, San Francisco, CA 94105, United States

    SUMMARY
    Principal Cloud Architect with 10+ years specializing in distributed systems, Kubernetes, and Golang.

    EXPERIENCE
    Lead Architect at CloudScale Systems | Jan 2020 - Present
    Engineered multi-region cloud deployment infrastructure.

    Senior DevOps Engineer at Matrix Corp | Jun 2016 - Dec 2019
    Designed CI/CD automation pipelines with Terraform and Docker.

    EDUCATION
    Bachelor of Science in Computer Engineering
    UC Berkeley, 2015
    GPA: 3.92

    SKILLS: Go, Kubernetes, Docker, AWS, Terraform, Python, CI/CD, PostgreSQL, Linux

    LINKS:
    LinkedIn: https://linkedin.com/in/elena-rostova
    GitHub: https://github.com/erostova
    Portfolio: https://elenarostova.dev
  `;

  const profile = localRuleBasedExtractor(completeResumeText);

  // Personal
  assert.equal(profile.personal.fullName, 'Elena Rostova');
  assert.equal(profile.personal.firstName, 'Elena');
  assert.equal(profile.personal.lastName, 'Rostova');
  assert.equal(profile.personal.email, 'elena.rostova@cloudscale.net');
  assert.equal(profile.personal.phone, '+1 (555) 789-0123');
  assert.equal(profile.personal.dateOfBirth, '1993-08-24');
  assert.equal(profile.personal.nationality, 'United States');

  // Address
  assert.equal(profile.address.street, '742 Evergreen Terrace');
  assert.equal(profile.address.city, 'San Francisco');
  assert.equal(profile.address.state, 'CA');
  assert.equal(profile.address.zip, '94105');
  assert.equal(profile.address.country, 'United States');

  // Experience
  assert.ok(profile.experience.length >= 2);
  assert.equal(profile.experience[0].title, 'Lead Architect');
  assert.equal(profile.experience[0].company, 'CloudScale Systems');

  // Education
  assert.ok(profile.education.length >= 1);
  assert.equal(profile.education[0].institution, 'UC Berkeley');
  assert.equal(profile.education[0].endYear, '2015');

  // Skills
  assert.ok(profile.skills.includes('Kubernetes'));
  assert.ok(profile.skills.includes('Docker'));
  assert.ok(profile.skills.includes('AWS'));
  assert.ok(profile.skills.includes('Terraform'));

  // Links
  assert.equal(profile.links.linkedin, 'https://linkedin.com/in/elena-rostova');
  assert.equal(profile.links.github, 'https://github.com/erostova');
  assert.equal(profile.links.portfolio, 'https://elenarostova.dev');
});
