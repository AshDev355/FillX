# QA Bug Log & Test Results — Member 4

> Keep this file updated in real time during testing. Add a row for every bug found.
> Priority: **P0** = blocks the demo, **P1** = major but workable around, **P2** = minor/polish.

---

## Test Form Checklist

Test the full pipeline (Upload → Extract → Profile → Detect → Match → Autofill → Highlight)
on each of the forms below. Check off each form as it passes end-to-end.

| # | Form / Site | URL | Status | Notes |
|---|------------|-----|--------|-------|
| 1 | Google Form (basic signup) | https://forms.google.com | ⬜ | |
| 2 | Google Form (job application style) | (create one with name/email/education fields) | ⬜ | |
| 3 | Typeform | https://typeform.com | ⬜ | |
| 4 | LinkedIn Easy Apply | https://linkedin.com | ⬜ | |
| 5 | Indeed Job Application | https://indeed.com | ⬜ | |
| 6 | GitHub signup | https://github.com/signup | ⬜ | |
| 7 | Government-style form | (e.g. a sample USCIS or tax form reproduction) | ⬜ | |
| 8 | Greenhouse (ATS job portal) | https://boards.greenhouse.io | ⬜ | |
| 9 | Workday (ATS job portal) | https://myworkdayjobs.com | ⬜ | |
| 10 | Custom React/Vue form (build a test page) | local test page | ⬜ | React-controlled inputs |

---

## Bug List

| ID | Date | Priority | Reporter | Component | Description | Steps to Reproduce | Expected | Actual | Status | Fix |
|----|------|----------|----------|-----------|-------------|-------------------|----------|--------|--------|-----|
| BUG-001 | | P0 | M4 | | | | | | Open | |
| BUG-002 | | P1 | M4 | | | | | | Open | |

*(Add rows as bugs are found. Copy a row, fill it in, change status to Closed when fixed.)*

---

## Bug Status Key

| Status | Meaning |
|--------|---------|
| Open | Not yet investigated |
| In Progress | Being fixed |
| Blocked | Needs another member to fix |
| Fixed (Unverified) | Fix applied, needs QA re-test |
| Closed | Verified fixed |
| Won't Fix | Out of scope for 2-day sprint |

---

## Testing Notes by Form

### Google Forms
- [ ] Name fields detected
- [ ] Email field detected
- [ ] Dropdown fields detected (e.g. year selects)
- [ ] File upload field correctly left blank (extension never fills file inputs)
- [ ] Required-field asterisks don't break label detection

### LinkedIn Easy Apply
- [ ] Multi-step form: "Fill this page" works on each step independently
- [ ] Phone number format matches what LinkedIn expects
- [ ] Resume upload field left blank

### React/Vue Controlled Inputs (critical test)
- [ ] Value actually registers (not just visually filled)
- [ ] Form validation triggers after autofill (e.g. "Email is required" clears)
- [ ] Dropdown/Select options match correctly

### Save New Field Flow
- [ ] Blur on an unmatched field shows the prompt
- [ ] Clicking "Yes" saves to chrome.storage.local
- [ ] Saved field appears in Profile tab under Custom Fields
- [ ] Next time the same field appears on any form, it is auto-filled

---

## Day 1 QA Focus (Hr 9–11)

- Upload a PDF resume → confirm structured JSON is extracted correctly
- Check profile stored in chrome.storage via DevTools (Application → Storage → Extension storage)
- Edit a field in Profile tab → confirm it persists after popup close/reopen
- Add a custom field → confirm it appears in storage

## Day 2 QA Focus (Hr 2–4 and Hr 6–8)

- Full pipeline on 5+ real forms
- "Save this for future forms?" flow
- Field highlighting colors correct on matched / ambiguous / unmatched
- Error states: no profile uploaded, API failure, no internet

---

## Regression Pass Checklist (Day 2 Hr 6–8)

Run through this list before the final integration checkpoint.

- [ ] Fresh install: no profile → Document tab shows upload prompt, Profile tab shows empty state
- [ ] Upload PDF → profile extracted → Profile tab populates correctly
- [ ] Edit a profile field → change persists after popup close
- [ ] Open Google Form → click Fill This Page → fields fill → highlights appear
- [ ] Ambiguous field highlighted yellow
- [ ] Unmatched field highlighted orange, counter in popup shows correct number
- [ ] Manually fill an unmatched field → save prompt appears → click Yes → field in Profile tab
- [ ] Replace document → profile updates correctly (overwrite flow)
- [ ] API call fails (turn off network) → graceful error shown in popup, no crash

---

## Demo Rehearsal Script (Hr 10–12 Day 2)

1. Show the popup with no profile → explain clean state
2. Upload a resume PDF → show AI extraction happening → show Profile tab filled in
3. Navigate to a Google Form in another tab → click extension icon → click "Fill This Page"
4. Show fields auto-filling, highlighted in green/yellow/orange
5. Manually fill one orange (unmatched) field → save prompt → click Yes
6. Show Profile tab → custom field now present
7. Navigate back to the form → re-click Fill This Page → previously unmatched field now fills

**Run this end-to-end at least twice before presenting.**

---

## Packaging Checklist (Chrome Web Store / Unpacked Demo)

- [ ] All console.log / debug statements removed or behind a DEBUG flag
- [ ] `manifest.json` has correct name, version, description, and icons
- [ ] Icons exist at 16×16, 48×48, 128×128 px (PNG)
- [ ] `web_accessible_resources` lists any resources injected into pages
- [ ] Gemini API key is NOT anywhere in the extension source code
- [ ] `.env.local` is in `.gitignore` and not committed to GitHub
- [ ] README written (Member 2 owns, Member 4 reviews)
- [ ] Extension loads via "Load unpacked" on a fresh Chrome profile with no errors
