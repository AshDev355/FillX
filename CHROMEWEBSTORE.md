# Chrome Web Store Listing & Deployment Metadata

> Single source of truth for FillX Chrome Web Store listing, permissions justifications, privacy disclosures, and version history.

---

## Listing Metadata

- **Extension Name**: FillX - AI-Powered Autofill
- **Short Description** (≤ 132 chars): AI-powered intelligent autofill Chrome extension for job applications and complex web forms.
- **Detailed Description**:
  FillX streamlines form filling and job applications by using AI to accurately detect and fill form fields based on your extracted resume or profile.

  Key Features:
  - Smart Form Detection: Automatically recognizes standard inputs, textareas, and dropdown selects.
  - Deep Framework Support: Reliably fills React-controlled, Vue-reactive, and native form fields without breaking validation.
  - Visual Review Highlights: Highlights confident matches in green, ambiguous fields in amber for review, and unmatched fields in dashed red.
  - Attention Counter: Informs you exactly how many fields need manual review before submitting.
  - Privacy First: Never automatically submits forms or invents false information.

- **Category**: Productivity
- **Primary Language**: English

---

## Permissions Justification

| Permission | Justification |
|---|---|
| `storage` | Required to store user profile data and autofill settings locally on the user's device. |
| `activeTab` | Required to detect form fields on the active webpage when the user opens the extension or requests autofill. |
| `scripting` | Required to inject the content script and apply non-destructive field highlighting on the active tab. |
| `tabs` | Required to communicate matching results and field states between the background worker and the active tab. |

### Host Permissions
- `<all_urls>` / `http://*/*` / `https://*/*`: Required to allow users to autofill job applications and forms across any webpage domain they visit.
- `http://localhost:3000/*`: Development API endpoint for local testing and AI matching backend.

---

## Privacy & Data Use Disclosures

- **Single Purpose**: Autofill web forms using user-supplied profile data.
- **Data Collection**:
  - Personal Information (Name, Email, Phone, Address, Work History): Stored locally in `chrome.storage.local` to facilitate form matching.
  - Form Fields Context: Only form labels and placeholders on the active page are read during an autofill request.
- **Data Sharing**:
  - Form field metadata and profile data are sent to the user's configured matching API endpoint (`/api/match`) exclusively to generate field matches.
  - Data is never sold, transferred to third parties for advertising, or collected without user initiation.
- **User Control**: Users can clear their profile, clear all highlights, or edit cached fields at any time.

---

## Version History

### Version 1.0.0 (2026-08-26)
- Initial release of Member 1 Extension Core & Autofill Engine.
- Form field detection across input, textarea, and select elements.
- Framework-aware value injection (React 15-19, Vue 2-3, native DOM).
- Visual highlighting system (matched, ambiguous, unmatched) with reversible cleanup.
- Attention counter implementation (`fieldsNeedAttention`).
- MutationObserver for dynamic form support.
- Background relay worker with offline heuristic mock adapter.
