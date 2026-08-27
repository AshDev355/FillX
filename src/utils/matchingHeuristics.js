/**
 * matchingHeuristics.js — Weighted Heuristic Matcher & Classification Engine
 *
 * Maps extracted user profile fields to DOM input fields without external
 * network latency. Provides high-precision weighted scoring with confidence
 * values.
 *
 * Improvements over previous version:
 *   - clean(): normalizes camelCase / PascalCase data-testid strings to words
 *   - scoreClues(): weighted scoring — label > name/id > placeholder > nearby
 *   - dataAttrs / titleAttr matching for React test-id-heavy apps
 *   - New matchers: salary, availability/start date, referral/source
 *   - Fixed name-field false positives (username, filename, screen_name excluded)
 *   - AMBIGUOUS classification when score is in the 0.3–0.6 confidence band
 */

import { MATCH_STATUS } from '../shared/messageTypes.js';

// ─── Text Normalisation ───────────────────────────────────────────────────────

/**
 * Converts a raw identifier / label string to a clean, space-separated lowercase
 * string safe for keyword matching.
 * Handles:
 *   - snake_case, kebab-case, dot.case
 *   - camelCase and PascalCase (split on uppercase boundaries)
 *   - Unicode accents
 *   - Repeated whitespace
 *
 * @param {string} str
 * @returns {string}
 */
function clean(str) {
  if (!str) return '';

  // Expand camelCase / PascalCase: "firstName" → "first Name"
  const expanded = String(str).replace(/([a-z])([A-Z])/g, '$1 $2');

  return expanded
    .toLowerCase()
    // Strip accents (NFD decompose → strip combining marks)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace non-alpha-numeric to space
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text, keywords) {
  if (!text) return false;
  return keywords.some((kw) => text.includes(kw));
}

// ─── Weighted Clue Scorer ─────────────────────────────────────────────────────

/**
 * Builds a weighted "signal map" from a field descriptor.
 * Each signal source is assigned a weight that reflects how reliable it is
 * as a label indicator.
 *
 * Weights:
 *   label            1.00  — most authoritative
 *   ariaLabel        0.95
 *   name / id        0.85
 *   placeholder      0.75
 *   titleAttr        0.65
 *   dataAttrs        0.60
 *   nearbyText       0.40  — least reliable (can be parent container text)
 *
 * @param {object} field
 * @returns {{ allClues: string, sources: Array<{ text: string, weight: number }> }}
 */
function buildClueMap(field) {
  const sources = [
    { text: clean(field.label || ''),       weight: 1.00 },
    { text: clean(field.ariaLabel || ''),   weight: 0.95 },
    { text: clean(field.name || ''),        weight: 0.85 },
    { text: clean(field.id || ''),          weight: 0.85 },
    { text: clean(field.placeholder || ''), weight: 0.75 },
    { text: clean(field.autocomplete || ''), weight: 0.80 },
    { text: clean(field.titleAttr || ''),   weight: 0.65 },
    // data-testid, data-name, data-label, data-field
    ...Object.values(field.dataAttrs || {}).map((v) => ({
      text: clean(v), weight: 0.60,
    })),
    { text: clean(field.nearbyText || '').slice(0, 100), weight: 0.40 },
  ].filter((s) => s.text.length > 0);

  const allClues = sources.map((s) => s.text).join(' ');
  return { allClues, sources };
}

/**
 * Returns the maximum weight of any source that contains at least one keyword.
 * Used to set confidence proportional to how authoritative the matched signal is.
 *
 * @param {Array<{ text: string, weight: number }>} sources
 * @param {string[]} keywords
 * @returns {number} 0 if no match
 */
function maxWeightForKeywords(sources, keywords) {
  let maxW = 0;
  for (const { text, weight } of sources) {
    if (keywords.some((kw) => text.includes(kw)) && weight > maxW) {
      maxW = weight;
    }
  }
  return maxW;
}

// ─── Open-Ended Detection ─────────────────────────────────────────────────────

/**
 * Checks if a field descriptor indicates an open-ended essay / long-form answer.
 * @param {object} field
 * @returns {boolean}
 */
export function isOpenEndedFieldDescriptor(field) {
  if (!field) return false;
  const isTextarea = field.type === 'textarea' || field.tagName === 'TEXTAREA';
  const clues = clean(
    `${field.name} ${field.id} ${field.label} ${field.placeholder} ${field.ariaLabel}`
  );
  const openPhrases = [
    'why', 'describe', 'tell us', 'cover letter', 'statement', 'explanation',
    'tell me', 'experience with', 'background in', 'interest in', 'summary',
    'share more', 'essay', 'motivation', 'about you', 'yourself',
  ];
  return isTextarea || openPhrases.some((p) => clues.includes(p));
}

// ─── False-Positive Guard Lists ───────────────────────────────────────────────
// Used to exclude fields that contain "name" but are NOT personal name fields.
const NAME_EXCLUSIONS = [
  'username', 'user name', 'company name', 'file name', 'screen name',
  'domain name', 'project name', 'organization', 'org name', 'business name',
  'employer', 'school name', 'team name', 'account name', 'product name',
];

// ─── Main Matcher ─────────────────────────────────────────────────────────────

/**
 * Matches an array of DOM field representations against user profile data.
 *
 * @param {Array<object>} fields   — detected field descriptors from fieldDetector
 * @param {object}        profile  — canonical profile object
 * @returns {Array<object>}  [{ fieldId, status, value, confidence, isOpenEnded }]
 */
export function matchFieldsWithHeuristics(fields, profile) {
  if (!Array.isArray(fields)) return [];

  const p = profile || {};
  const personal  = p.personal  || {};
  const address   = p.address   || {};
  const links     = p.links     || {};
  const custom    = { ...(p.custom || {}), ...(p.customFields || {}) };
  const education = Array.isArray(p.education) && p.education[0] ? p.education[0] : {};
  const experience= Array.isArray(p.experience) && p.experience[0] ? p.experience[0] : {};
  const skills    = Array.isArray(p.skills) ? p.skills : [];
  const languages = Array.isArray(p.languages) ? p.languages : [];

  const results = [];

  for (const field of fields) {
    const { allClues, sources } = buildClueMap(field);
    const isOpenEnded = isOpenEndedFieldDescriptor(field);

    let status     = MATCH_STATUS.NO_MATCH;
    let value      = null;
    let confidence = 0;

    // Helper: try to match, set value+confidence, return true on success
    function tryMatch(keywords, getValue, baseConfidence) {
      if (value !== null) return false; // already matched
      const w = maxWeightForKeywords(sources, keywords);
      if (w === 0) return false;
      const candidate = getValue();
      if (candidate) {
        value      = candidate;
        confidence = Math.min(0.99, baseConfidence * w);
        status     = MATCH_STATUS.MATCHED;
        return true;
      }
      return false;
    }

    // ── 1. First Name ──────────────────────────────────────────────────────────
    tryMatch(
      ['first name', 'fname', 'given name', 'forename', 'given-name'],
      () =>
        personal.firstName ||
        custom.first_name || custom.firstname || custom.given_name ||
        (personal.fullName ? personal.fullName.split(' ')[0] : null),
      0.98
    );

    // Also match autocomplete="given-name" regardless of keyword
    if (!value && field.autocomplete === 'given-name') {
      const v = personal.firstName || (personal.fullName ? personal.fullName.split(' ')[0] : null);
      if (v) { value = v; confidence = 0.98; status = MATCH_STATUS.MATCHED; }
    }

    // ── 2. Last Name ───────────────────────────────────────────────────────────
    tryMatch(
      ['last name', 'lname', 'surname', 'family name', 'family-name'],
      () =>
        personal.lastName ||
        custom.last_name || custom.lastname || custom.surname ||
        (personal.fullName ? personal.fullName.split(' ').slice(1).join(' ') : null),
      0.98
    );
    if (!value && field.autocomplete === 'family-name') {
      const v = personal.lastName ||
        (personal.fullName ? personal.fullName.split(' ').slice(1).join(' ') : null);
      if (v) { value = v; confidence = 0.98; status = MATCH_STATUS.MATCHED; }
    }

    // ── 3. Full Name ───────────────────────────────────────────────────────────
    // Guard: must NOT be a username / company name field
    if (!value && !containsAny(allClues, NAME_EXCLUSIONS)) {
      const nameKws = ['full name', 'your name', 'applicant name', 'candidate name', 'real name'];
      // Loose "name" — only if no exclusion word present
      const looseMatch = allClues.includes('name') && !containsAny(allClues, NAME_EXCLUSIONS);
      if (containsAny(allClues, nameKws) || field.autocomplete === 'name' || looseMatch) {
        const v =
          personal.fullName ||
          custom.full_name || custom.fullname ||
          (personal.firstName && personal.lastName
            ? `${personal.firstName} ${personal.lastName}`
            : personal.firstName) ||
          null;
        if (v) { value = v; confidence = 0.94; status = MATCH_STATUS.MATCHED; }
      }
    }

    // ── 4. Email ───────────────────────────────────────────────────────────────
    if (!value) {
      if (field.type === 'email' || containsAny(allClues, ['email', 'e mail', 'mail']) || field.autocomplete === 'email') {
        const v = personal.email || custom.email || custom.email_address || null;
        if (v) { value = v; confidence = 0.99; status = MATCH_STATUS.MATCHED; }
      }
    }

    // ── 5. Phone ───────────────────────────────────────────────────────────────
    tryMatch(
      ['phone', 'mobile', 'cell', 'telephone', 'contact number', 'tel'],
      () => personal.phone || custom.phone || custom.phone_number || custom.mobile || null,
      0.96
    );
    if (!value && field.type === 'tel') {
      const v = personal.phone || custom.phone || null;
      if (v) { value = v; confidence = 0.96; status = MATCH_STATUS.MATCHED; }
    }

    // ── 6. Date of Birth ───────────────────────────────────────────────────────
    tryMatch(
      ['date of birth', 'birth date', 'dob', 'birthday', 'birth day'],
      () => personal.dateOfBirth || custom.date_of_birth || custom.dob || custom.birthday || null,
      0.92
    );

    // ── 7. Nationality / Citizenship ───────────────────────────────────────────
    tryMatch(
      ['nationality', 'citizenship', 'citizen'],
      () => personal.nationality || custom.nationality || custom.citizenship || null,
      0.90
    );

    // ── 8. Street Address ──────────────────────────────────────────────────────
    if (!value) {
      const isAddress =
        containsAny(allClues, ['street address', 'address line 1', 'street line', 'mailing address', 'address line1']) ||
        (allClues.includes('address') && !allClues.includes('email') && !allClues.includes('ip address')) ||
        field.autocomplete === 'street-address' ||
        field.autocomplete === 'address-line1';
      if (isAddress) {
        const v = address.street || custom.street_address || custom.street || custom.address || null;
        if (v) { value = v; confidence = 0.93; status = MATCH_STATUS.MATCHED; }
      }
    }

    // ── 9. City ────────────────────────────────────────────────────────────────
    tryMatch(
      ['city', 'town', 'municipality'],
      () => address.city || custom.city || custom.town || null,
      0.94
    );
    if (!value && field.autocomplete === 'address-level2') {
      const v = address.city || null;
      if (v) { value = v; confidence = 0.94; status = MATCH_STATUS.MATCHED; }
    }

    // ── 10. State / Province ───────────────────────────────────────────────────
    tryMatch(
      ['state', 'province', 'region'],
      () => address.state || custom.state || custom.province || null,
      0.90
    );
    if (!value && field.autocomplete === 'address-level1') {
      const v = address.state || null;
      if (v) { value = v; confidence = 0.90; status = MATCH_STATUS.MATCHED; }
    }

    // ── 11. ZIP / Postal Code ──────────────────────────────────────────────────
    tryMatch(
      ['zip', 'postal code', 'postcode', 'pin code', 'zip code'],
      () => address.zip || custom.zip || custom.zip_code || custom.postal_code || null,
      0.95
    );
    if (!value && field.autocomplete === 'postal-code') {
      const v = address.zip || null;
      if (v) { value = v; confidence = 0.95; status = MATCH_STATUS.MATCHED; }
    }

    // ── 12. Country ────────────────────────────────────────────────────────────
    tryMatch(
      ['country', 'nation'],
      () => address.country || custom.country || null,
      0.92
    );
    if (!value && (field.autocomplete === 'country' || field.autocomplete === 'country-name')) {
      const v = address.country || null;
      if (v) { value = v; confidence = 0.92; status = MATCH_STATUS.MATCHED; }
    }

    // ── 13. Company / Employer ─────────────────────────────────────────────────
    tryMatch(
      ['company', 'employer', 'organization', 'current company', 'previous company', 'firm'],
      () => experience.company || custom.company || custom.employer || custom.company_name || null,
      0.88
    );

    // ── 14. Job Title / Role ───────────────────────────────────────────────────
    tryMatch(
      ['job title', 'position', 'role', 'current title', 'occupation', 'designation'],
      () => experience.title || custom.job_title || custom.title || custom.position || null,
      0.88
    );

    // ── 15. University / School ────────────────────────────────────────────────
    tryMatch(
      ['school', 'university', 'college', 'institution', 'alma mater'],
      () => education.institution || education.school || custom.school || custom.university || null,
      0.88
    );

    // ── 16. Degree ─────────────────────────────────────────────────────────────
    tryMatch(
      ['degree', 'major', 'field of study', 'qualification'],
      () => education.degree || education.field || custom.degree || custom.major || null,
      0.88
    );

    // ── 17. Graduation Year ────────────────────────────────────────────────────
    tryMatch(
      ['graduation year', 'grad year', 'year of graduation', 'completion year'],
      () => education.endYear || education.year || custom.graduation_year || null,
      0.88
    );

    // ── 18. GPA ────────────────────────────────────────────────────────────────
    tryMatch(
      ['gpa', 'grade point average'],
      () => education.gpa || custom.gpa || null,
      0.90
    );

    // ── 19. Skills ─────────────────────────────────────────────────────────────
    tryMatch(
      ['skills', 'technologies', 'core skills', 'tech stack', 'technical skills'],
      () => (skills.length > 0 ? skills.join(', ') : custom.skills) || null,
      0.85
    );

    // ── 20. Languages ──────────────────────────────────────────────────────────
    tryMatch(
      ['languages', 'spoken languages'],
      () => (languages.length > 0 ? languages.join(', ') : custom.languages) || null,
      0.85
    );

    // ── 21. LinkedIn ───────────────────────────────────────────────────────────
    tryMatch(
      ['linkedin', 'linkedin profile', 'linkedin url'],
      () => links.linkedin || custom.linkedin || null,
      0.96
    );

    // ── 22. GitHub ─────────────────────────────────────────────────────────────
    tryMatch(
      ['github', 'github profile', 'github url', 'git'],
      () => links.github || custom.github || null,
      0.96
    );

    // ── 23. Portfolio / Website ────────────────────────────────────────────────
    tryMatch(
      ['portfolio', 'website', 'personal site', 'personal website', 'blog'],
      () => links.portfolio || custom.portfolio || custom.website || null,
      0.90
    );

    // ── 24. Salary / Compensation ──────────────────────────────────────────────
    tryMatch(
      ['salary', 'compensation', 'expected salary', 'desired pay', 'pay expectation', 'ctc'],
      () => custom.salary || custom.expected_salary || custom.compensation || null,
      0.82
    );

    // ── 25. Availability / Start Date ─────────────────────────────────────────
    tryMatch(
      ['start date', 'available from', 'availability', 'notice period', 'joining date', 'when can you start'],
      () => custom.availability || custom.start_date || custom.notice_period || null,
      0.80
    );

    // ── 26. Referral / How Did You Hear ───────────────────────────────────────
    tryMatch(
      ['how did you hear', 'referral source', 'referred by', 'where did you find'],
      () => custom.referral_source || custom.how_did_you_hear || null,
      0.78
    );

    // ── 27. Custom Fields Feedback Loop ───────────────────────────────────────
    if (!value) {
      for (const [k, v] of Object.entries(custom)) {
        const normalizedKey = clean(k);
        if (normalizedKey && allClues.includes(normalizedKey)) {
          value      = v;
          confidence = 0.78;
          status     = MATCH_STATUS.MATCHED;
          break;
        }
      }
    }

    // ── 28. Ambiguous Classification ───────────────────────────────────────────
    // If value found but label contains uncertain qualifiers → downgrade to AMBIGUOUS
    if (value && containsAny(allClues, [
      'preferred', 'alternate', 'secondary', 'additional', 'optional', 'other',
    ])) {
      status     = MATCH_STATUS.AMBIGUOUS;
      confidence = Math.min(confidence, 0.65);
    }

    // ── 29. Low-Confidence → Ambiguous instead of Matched ─────────────────────
    // Weighted signal was only from low-reliability sources (nearbyText, dataAttrs)
    if (status === MATCH_STATUS.MATCHED && confidence < 0.55) {
      status = MATCH_STATUS.AMBIGUOUS;
    }

    // Strict No-Hallucination: if value is empty, force NO_MATCH
    if (!value) {
      status     = MATCH_STATUS.NO_MATCH;
      value      = null;
      confidence = 0;
    }

    results.push({
      fieldId: field.fieldId,
      status,
      value,
      confidence,
      isOpenEnded,
    });
  }

  return results;
}
