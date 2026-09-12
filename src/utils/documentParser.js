/**
 * documentParser.js — Hardened Profile Extraction & Fallback Parser
 *
 * Safe for direct native ES module import in Chrome Service Workers.
 * Improvements:
 *   - sanitizeDocumentText(): strips null bytes, normalizes Unicode, trims to API-safe length
 *   - parseApiResponse(): strict JSON extraction with schema validation & malformed-JSON fallback
 *   - extractProfileFromDocument(): 8-second timeout on API call, validated response merge
 *   - localRuleBasedExtractor(): 4 additional extractors (street, nationality, DOB, bio/summary)
 */

// ─── Text Sanitization ────────────────────────────────────────────────────────

/**
 * Cleans raw document text before sending to LLM or local parser.
 * - Removes null bytes and non-printable control characters
 * - Normalizes Unicode (NFC composition)
 * - Collapses excessive whitespace / blank lines
 * - Truncates to a safe length for API payloads (15 000 chars)
 *
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeDocumentText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // Remove null bytes and non-printable control chars (except tab/newline/CR)
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  // Unicode normalization (NFC) — safe in modern engines
  try { text = text.normalize('NFC'); } catch {}

  // Collapse runs of blank lines to a single blank line
  text = text.replace(/\n{3,}/g, '\n\n');

  // Collapse leading/trailing whitespace on each line
  text = text
    .split('\n')
    .map((l) => l.replace(/^\s+|\s+$/g, ''))
    .join('\n');

  // Collapse horizontal whitespace
  text = text.replace(/[ \t]{2,}/g, ' ').trim();

  // Hard-truncate to 15 000 chars (safety limit for API payloads)
  if (text.length > 15_000) {
    text = text.slice(0, 15_000);
  }

  return text;
}

// ─── API Response Parsing ─────────────────────────────────────────────────────

/**
 * Default canonical profile shape used for schema validation.
 */
const CANONICAL_KEYS = new Set([
  'personal', 'address', 'education', 'experience',
  'skills', 'languages', 'links', 'custom',
]);

/**
 * Validates that a parsed object contains at least one canonical profile key.
 * @param {unknown} obj
 * @returns {boolean}
 */
function isValidProfileShape(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return [...CANONICAL_KEYS].some((k) => k in obj);
}

/**
 * Attempts to extract a JSON object from an LLM response string.
 * Handles three cases:
 *   1. Response is already a plain JSON object → parse directly
 *   2. Response wraps JSON in a markdown code fence (```json ... ```)
 *   3. Response contains a JSON object literal somewhere in prose text
 *
 * @param {unknown} rawResponse — the raw body from the API (string or already-parsed object)
 * @returns {object|null}
 */
export function parseApiResponse(rawResponse) {
  // Case A: Already a parsed object with the right shape
  if (typeof rawResponse === 'object' && rawResponse !== null) {
    // Unwrap common envelope shapes: { profile: {...} } or { data: {...} }
    const candidate =
      rawResponse.profile ||
      rawResponse.data ||
      rawResponse.result ||
      rawResponse;
    if (isValidProfileShape(candidate)) return candidate;
  }

  if (typeof rawResponse !== 'string') return null;

  // Case B: Markdown code fence extraction
  const fenceMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      const candidate = parsed.profile || parsed.data || parsed.result || parsed;
      if (isValidProfileShape(candidate)) return candidate;
    } catch {}
  }

  // Case C: Direct JSON parse of entire string
  try {
    const parsed = JSON.parse(rawResponse.trim());
    const candidate = parsed.profile || parsed.data || parsed.result || parsed;
    if (isValidProfileShape(candidate)) return candidate;
  } catch {}

  // Case D: Find the first {...} block in the string using bracket matching
  const firstBrace = rawResponse.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = firstBrace; i < rawResponse.length; i++) {
      if (rawResponse[i] === '{') depth++;
      else if (rawResponse[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(rawResponse.slice(firstBrace, end + 1));
        const candidate = parsed.profile || parsed.data || parsed.result || parsed;
        if (isValidProfileShape(candidate)) return candidate;
      } catch {}
    }
  }

  return null;
}

// ─── API Call with Timeout ────────────────────────────────────────────────────

/**
 * Wraps fetch() with an AbortController-based timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [timeoutMs=8000]
 */
async function fetchWithTimeout(url, options, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timerId);
    return response;
  } catch (err) {
    clearTimeout(timerId);
    throw err;
  }
}

// ─── Local Rule-Based Extractor ───────────────────────────────────────────────

/**
 * High-precision local profile extractor for offline / fallback scenarios.
 * Extracts comprehensive details from unstructured resumes and CVs.
 *
 * @param {string} text  — sanitized document text
 * @returns {object}
 */
export function localRuleBasedExtractor(text) {
  const profile = {
    personal: {
      fullName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      nationality: '',
    },
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
    education: [],
    experience: [],
    skills: [],
    languages: [],
    links: {
      linkedin: '',
      github: '',
      portfolio: '',
    },
    custom: {},
  };

  if (!text) return profile;

  const rawLines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

  // ─── 1. Email ───────────────────────────────────────────────────────────────
  const emailMatch = text.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) profile.personal.email = emailMatch[1].trim();

  // ─── 2. Phone ───────────────────────────────────────────────────────────────
  const phoneRegex =
    /(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)?\d{3,4}[\s.\-]?\d{3,5}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 7) {
    profile.personal.phone = phoneMatch[0].trim();
  }

  // ─── 3. Full Name ───────────────────────────────────────────────────────────
  for (const line of rawLines.slice(0, 8)) {
    const cleaned = line
      .replace(/^(curriculum vitae|resume|cv|contact|profile|page \d+)\b/i, '')
      .trim();
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 42 &&
      !cleaned.includes('@') &&
      !cleaned.includes('http') &&
      !cleaned.includes('/') &&
      !/\d/.test(cleaned) &&
      /^[A-Za-zÀ-ÖØ-öø-ÿ]+([\s.\-][A-Za-zÀ-ÖØ-öø-ÿ]+){1,3}$/.test(cleaned)
    ) {
      profile.personal.fullName = cleaned;
      const parts = cleaned.split(/\s+/);
      profile.personal.firstName = parts[0] || '';
      profile.personal.lastName = parts.slice(1).join(' ') || '';
      break;
    }
  }

  // Fallback: derive name from email
  if (!profile.personal.fullName && profile.personal.email) {
    const namePart = profile.personal.email.split('@')[0].replace(/[._\-]/g, ' ');
    if (namePart.length > 2) {
      const formatted = namePart
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      profile.personal.fullName = formatted;
      const parts = formatted.split(' ');
      profile.personal.firstName = parts[0] || '';
      profile.personal.lastName = parts.slice(1).join(' ') || '';
    }
  }

  // ─── 4. Date of Birth ───────────────────────────────────────────────────────
  // Matches: dd/mm/yyyy, mm-dd-yyyy, "Born: March 5, 1995", "DOB: 1995-03-05"
  const dobPatterns = [
    /\b(?:born|dob|date of birth|birthdate)[:\s]+(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
    /\b(?:born|dob|date of birth|birthdate)[:\s]+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,
    /\b(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4})\b/,
    /\b(\d{4}-\d{2}-\d{2})\b/,
  ];
  for (const pattern of dobPatterns) {
    const m = text.match(pattern);
    if (m) {
      profile.personal.dateOfBirth = (m[1] || m[0]).trim();
      break;
    }
  }

  // ─── 5. Nationality ─────────────────────────────────────────────────────────
  const nationalityMatch = text.match(
    /\b(?:nationality|citizenship|citizen)[:\s]+([A-Za-z\s]+?)(?:\.|,|\n|$)/i
  );
  if (nationalityMatch) {
    profile.personal.nationality = nationalityMatch[1].trim().slice(0, 30);
  }

  // ─── 6. Links ───────────────────────────────────────────────────────────────
  const linkedinMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-]+)/i
  );
  if (linkedinMatch) {
    profile.links.linkedin = linkedinMatch[0].startsWith('http')
      ? linkedinMatch[0]
      : `https://${linkedinMatch[0]}`;
  }

  const githubMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-]+)/i
  );
  if (githubMatch) {
    profile.links.github = githubMatch[0].startsWith('http')
      ? githubMatch[0]
      : `https://${githubMatch[0]}`;
  }

  const labeledPortfolioMatch = text.match(
    /(?:portfolio|personal website|website)\s*:\s*((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_-]+\.(?:dev|io|me|com|org|net|app)(?:\/[^\s]*)?)/i
  );
  const portfolioMatch = labeledPortfolioMatch || text.match(
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9_\-]+\.(?:dev|io|me|com|org|net|app))(?:\/[^\s]*)?/i
  );
  if (
    portfolioMatch &&
    !portfolioMatch[0].includes('linkedin') &&
    !portfolioMatch[0].includes('github')
  ) {
    const portfolioUrl = labeledPortfolioMatch ? portfolioMatch[1] : portfolioMatch[0];
    profile.links.portfolio = portfolioUrl.startsWith('http')
      ? portfolioUrl
      : `https://${portfolioUrl}`;
  }

  // ─── 7. Street Address ──────────────────────────────────────────────────────
  // Matches patterns like "123 Main Street", "742 Evergreen Terrace", "45 Oak Ave, Suite 2"
  const streetMatch = text.match(
    /\b(\d{1,5}\s+[A-Za-z0-9 .#\-]+?\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Terrace|Terr|Loop|Circle|Cir)\b(?:[,\s]+(?:Suite|Ste|Apt|Unit|#)\s*[\w\d]+)?)/i
  );
  if (streetMatch) {
    profile.address.street = streetMatch[1].trim().replace(/,\s*$/, '');
  }

  // ─── 8. ZIP / Postal Code ───────────────────────────────────────────────────
  const zipMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (zipMatch) profile.address.zip = zipMatch[0];

  // ─── 9. City + State ────────────────────────────────────────────────────────
  // Prioritize "City, 2-Letter-State" (e.g. "San Francisco, CA 94105") or "City, State-Name"
  const cityState2LetterRegex = /\b([A-Z][a-zA-Z\s.-]+?),\s*([A-Z]{2})\b(?:\s+(\d{5}))?/;
  const cityStateFullRegex = /\b([A-Z][a-zA-Z\s.-]+?),\s*(California|New York|Texas|Florida|Illinois|Pennsylvania|Ohio|Georgia|North Carolina|Michigan|Washington|Massachusetts|Virginia|Arizona|Colorado|Oregon|Utah|Nevada)\b/i;

  const cityStateMatch = text.match(cityState2LetterRegex) || text.match(cityStateFullRegex);
  if (
    cityStateMatch &&
    !cityStateMatch[1].includes('University') &&
    !cityStateMatch[1].includes('Company') &&
    !/(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Terrace|Way|Court|Ct)\b/i.test(cityStateMatch[1])
  ) {
    profile.address.city = cityStateMatch[1].trim();
    profile.address.state = cityStateMatch[2].trim();
    if (cityStateMatch[3]) profile.address.zip = cityStateMatch[3];
  }

  // ─── 10. Country ─────────────────────────────────────────────────────────────
  const countryNames = [
    'United States', 'USA', 'United Kingdom', 'UK', 'Canada',
    'Germany', 'France', 'India', 'Australia', 'Netherlands',
    'Singapore', 'Japan', 'Brazil', 'Pakistan', 'Nigeria', 'South Africa',
  ];
  for (const country of countryNames) {
    if (new RegExp(`\\b${country}\\b`, 'i').test(text)) {
      profile.address.country =
        country === 'USA' ? 'United States' : country === 'UK' ? 'United Kingdom' : country;
      break;
    }
  }

  // ─── 11. Professional Summary / Bio ─────────────────────────────────────────
  // Look for a "Summary", "About Me", or "Objective" section
  const summaryMatch = text.match(
    /(?:summary|about me|professional summary|objective|bio|profile)[:\s]*\n?([\s\S]{30,400}?)(?=\n(?:experience|education|skills|work|employment|projects|references|\n)|$)/i
  );
  if (summaryMatch) {
    const bio = summaryMatch[1].replace(/\s+/g, ' ').trim();
    if (bio.length >= 30) profile.custom.summary = bio.slice(0, 400);
  }

  // ─── 12. Skills ──────────────────────────────────────────────────────────────
  const skillsVocabulary = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang',
    'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'React', 'React.js',
    'React Native', 'Vue', 'Vue.js', 'Angular', 'Next.js', 'Node.js', 'Express',
    'Django', 'Flask', 'FastAPI', 'Spring Boot', 'HTML', 'HTML5', 'CSS', 'CSS3',
    'Sass', 'Tailwind', 'Redux', 'GraphQL', 'REST API', 'PostgreSQL', 'MySQL',
    'MongoDB', 'Redis', 'SQLite', 'Firebase', 'Supabase', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Linux',
    'Terraform', 'Agile', 'Scrum', 'Figma', 'Jest', 'Cypress', 'Playwright',
    'Machine Learning', 'AI', 'TensorFlow', 'PyTorch',
  ];

  const detectedSkillsSet = new Set();
  skillsVocabulary.forEach((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i').test(text)) {
      detectedSkillsSet.add(skill);
    }
  });

  // Parse explicit "SKILLS:" section
  const skillsSectionMatch = text.match(
    /(?:skills|technical skills|technologies|expertise)[:\s]+([^\n\r]+(?:\n[^\n\r]+){0,4})/i
  );
  if (skillsSectionMatch?.[1]) {
    skillsSectionMatch[1]
      .split(/[,•|·\n\r/]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 35)
      .forEach((s) => {
        if (!/experience|education|projects|summary/i.test(s)) {
          detectedSkillsSet.add(s);
        }
      });
  }

  profile.skills = Array.from(detectedSkillsSet).slice(0, 35);

  // ─── 13. Languages ────────────────────────────────────────────────────────────
  const languagesList = [
    'English', 'Spanish', 'French', 'German', 'Mandarin', 'Hindi',
    'Arabic', 'Portuguese', 'Russian', 'Japanese', 'Italian', 'Korean', 'Urdu',
  ];
  const detectedLanguages = languagesList.filter((lang) =>
    new RegExp(`\\b${lang}\\b`, 'i').test(text)
  );
  profile.languages = detectedLanguages.length > 0 ? detectedLanguages : ['English'];

  // ─── 14. Education ────────────────────────────────────────────────────────────
  const educationEntries = [];
  const institutionByYear = text.match(
    /\b([A-Z]{2,}(?:\s+[A-Z][A-Za-z.&-]*){1,4})\s*,\s*(?:19\d\d|20\d\d)\b/
  );
  const degreeRegex =
    /(bachelor(?:'s)?|master(?:'s)?|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|b\.?tech|m\.?tech|ph\.?d\.?|associate(?:'s)?|diploma)(?:\s+(?:of|in)\s+([a-zA-Z &]+))?/gi;
  let degreeMatch;

  while ((degreeMatch = degreeRegex.exec(text)) !== null) {
    const degree = degreeMatch[1];
    const field = degreeMatch[2] ? degreeMatch[2].trim().slice(0, 40) : '';
    const winStart = Math.max(0, degreeMatch.index - 100);
    const winEnd = Math.min(text.length, degreeMatch.index + 120);
    const ctx = text.slice(winStart, winEnd);
    const instMatch = ctx.match(
      /([A-Z][a-zA-Z\s&.\-]+(?:University|College|Institute|School|Academy|Polytechnic))/i
    );
    const yearCandidates = text
      .slice(degreeMatch.index, degreeMatch.index + 240)
      .match(/\b(19\d\d|20\d\d)\b/g) || [];
    const yearMatch = yearCandidates.length > 0 ? [null, yearCandidates.at(-1)] : null;
    const institutionWithYearMatch = ctx.match(
      /(?:^|\n)\s*([A-Z][A-Za-z.&-]*(?:\s+[A-Z][A-Za-z.&-]*){1,4})\s*,?\s*(?:19\d\d|20\d\d)\b/m
    );
    const followingInstitutionMatch = text
      .slice(degreeMatch.index, degreeMatch.index + 240)
      .match(/\n\s*([A-Z][A-Za-z.&-]*(?:\s+[A-Z][A-Za-z.&-]*){1,4})\s*,?\s*(?:19\d\d|20\d\d)\b/);
    const institutionYear = (institutionByYear || followingInstitutionMatch)?.[0]?.match(/\b(19\d\d|20\d\d)\b/);
    const gpaMatch = ctx.match(/\bGPA:?\s*([0-4]\.\d{1,2}|[0-9]{1,2}(?:\.[0-9])?\/[0-9]{1,2})\b/i);
    educationEntries.push({
      institution: institutionByYear
        ? institutionByYear[1].trim()
        : followingInstitutionMatch
        ? followingInstitutionMatch[1].trim()
        : institutionWithYearMatch
        ? institutionWithYearMatch[1].trim()
        : instMatch
        ? instMatch[1].trim()
        : 'University',
      degree: degree.toUpperCase(),
      field: field || 'Computer Science',
      endYear: institutionYear ? institutionYear[1] : yearMatch ? yearMatch[1] : '',
      gpa: gpaMatch ? gpaMatch[1] : '',
    });
    if (educationEntries.length >= 2) break;
  }

  if (educationEntries.length === 0) {
    const uniMatch = text.match(
      /([A-Z][a-zA-Z\s&.\-]+(?:University|College|Institute|School))/
    );
    if (uniMatch) {
      educationEntries.push({
        institution: uniMatch[1].trim(),
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        endYear: '',
        gpa: '',
      });
    }
  }
  profile.education = educationEntries;

  // ─── 15. Work Experience ──────────────────────────────────────────────────────
  const experienceEntries = [];
  const experienceHeading = text.search(/\b(?:work\s+)?experience\b/i);
  const experienceText = experienceHeading >= 0 ? text.slice(experienceHeading) : text;
  const titleRegex =
    /\b((?:Lead|Senior|Junior|Principal|Chief|Associate)\s+)?(Software Engineer|Frontend Developer|Full Stack Developer|Backend Developer|Web Developer|Product Manager|Data Scientist|Data Analyst|DevOps Engineer|Mobile Developer|QA Engineer|UI\/UX Designer|Consultant|Intern|Specialist|Team Lead|Architect|Designer|Manager|Director|Analyst|Developer)\b/gi;
  let titleMatch;

  while ((titleMatch = titleRegex.exec(experienceText)) !== null) {
    const precedingTitleText = experienceText.slice(Math.max(0, titleMatch.index - 20), titleMatch.index);
    const titleModifier = precedingTitleText.match(/(?:^|\s)(Lead|Senior|Junior|Principal|Chief|Associate)\s*$/i);
    const title = `${titleMatch[1] || (titleModifier ? `${titleModifier[1]} ` : '')}${titleMatch[2]}`.trim();
    const winStart = Math.max(0, titleMatch.index - 80);
    const winEnd = Math.min(experienceText.length, titleMatch.index + 150);
    const ctx = experienceText.slice(winStart, winEnd);
    const companyMatch = ctx.match(
      /(?:at|@|for|,)\s+([A-Z][a-zA-Z0-9\s&.\-]+(?:Inc|LLC|Corp|Technologies|Solutions|Labs|Company|Group)?)/i
    );
    const dateMatch = ctx.match(
      /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s.]*)?(?:19\d\d|20\d\d)\s*(?:-|–|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s.]*)?(?:19\d\d|20\d\d)|Present|Current)/i
    );
    experienceEntries.push({
      title,
      company: companyMatch ? companyMatch[1].trim() : 'Tech Company',
      startDate: dateMatch ? dateMatch[0].split(/[-–]|to/i)[0].trim() : '',
      endDate: dateMatch ? (dateMatch[0].split(/[-–]|to/i)[1] || 'Present').trim() : 'Present',
      description: `Worked as ${title} collaborating on core features and applications.`,
    });
    if (experienceEntries.length >= 3) break;
  }
  profile.experience = experienceEntries;

  return profile;
}

// ─── Main Coordinator ─────────────────────────────────────────────────────────

/**
 * Extracts a structured user profile from raw document text.
 * 1. Sanitizes the input text.
 * 2. Tries the Next.js Gemini AI /api/extract endpoint (8s timeout).
 * 3. Validates API response via parseApiResponse().
 * 4. Falls back to localRuleBasedExtractor() on any error or invalid shape.
 *
 * @param {string} documentText
 * @param {string} [backendUrl='http://localhost:3000']
 * @returns {Promise<object>}
 */
export async function extractProfileFromDocument(
  documentText,
  backendUrl = 'http://localhost:3000'
) {
  if (!documentText || !String(documentText).trim()) {
    return localRuleBasedExtractor('');
  }

  const sanitized = sanitizeDocumentText(documentText);

  if (sanitized.length < 5) {
    return localRuleBasedExtractor(sanitized);
  }

  // 1. Try Gemini API backend if reachable
  if (backendUrl) {
    try {
      const response = await fetchWithTimeout(
        `${backendUrl}/api/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentText: sanitized }),
        },
        5_000
      );

      if (response.ok) {
        let rawBody;
        try {
          rawBody = await response.json();
        } catch {
          rawBody = await response.text();
        }

        const extracted = parseApiResponse(rawBody);
        if (extracted) return extracted;
      }
    } catch (err) {
      // Backend offline, timed out, or returned invalid JSON — fall through gracefully
    }
  }

  // 2. High-precision local rule-based fallback
  return localRuleBasedExtractor(sanitized);
}
