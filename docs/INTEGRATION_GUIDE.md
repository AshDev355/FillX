# FillX Member 1 — Extension Core & Autofill Integration Guide

This document defines the interface contracts, message protocols, and integration points for **Member 1 (Extension Core Engineer — Content Script & Autofill)** on the `extension-ui` branch.

---

## 1. Overview & Architecture

Member 1 owns the webpage-side functionality and communication relay:
1. **DOM Form Field Detection**: Identifies `<input>`, `<textarea>`, `<select>`, labels, placeholders, aria attributes, and surrounding context.
2. **Reliable DOM Mapping**: Assigns unique `fieldId`s and maps them to DOM elements.
3. **Framework-Aware Autofill**: Injects values into native, React-controlled (15/16/17/18/19), and Vue-controlled (2/3) inputs, triggering full synthetic event lifecycles (`focus`, `input`, `change`, `blur`).
4. **Visual Highlighting & Status Badges**: Non-destructive, reversible highlighting for `matched` (green), `ambiguous` (amber/review), and `unmatched` (dashed red) fields.
5. **Attention Counter**: Computes `fieldsNeedAttention = ambiguousCount + unmatchedCount`.
6. **Dynamic Mutation Observation**: Automatically detects dynamic DOM modifications (SPAs, multi-step wizards) and triggers debounced rescans.
7. **Background Service Worker Relay**: Relays messages between Content Script, Popup UI, and `/api/match`, with local offline mock fallback.

---

## 2. Integration with Member 2 (Backend / APIs)

### A. Endpoint: `POST http://localhost:3000/api/match`

When autofill is triggered, the background service worker sends the following payload to Member 2's `/api/match` route:

#### Request Body
```json
{
  "fields": [
    {
      "fieldId": "field_1_first_name_text",
      "name": "first_name",
      "type": "text",
      "tagName": "INPUT",
      "placeholder": "e.g. John",
      "label": "First Name",
      "ariaLabel": "",
      "nearbyText": "Personal Information",
      "required": true,
      "autocomplete": "given-name",
      "options": []
    },
    {
      "fieldId": "field_7_country_select",
      "name": "country_select",
      "type": "select",
      "tagName": "SELECT",
      "placeholder": "",
      "label": "Country",
      "ariaLabel": "Select Country",
      "nearbyText": "",
      "options": ["United States", "Canada", "United Kingdom", "Germany", "Australia"]
    }
  ],
  "profile": {
    "personal": {
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "Johnathan Doe",
      "email": "john.doe@example.com",
      "phone": "+1 (555) 234-5678",
      "dateOfBirth": "1995-06-15"
    },
    "address": {
      "street": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "Oregon",
      "zip": "97477",
      "country": "United States"
    },
    "education": [
      { "school": "Springfield University", "degree": "B.S. in Computer Science", "year": "2017" }
    ],
    "experience": [
      { "company": "Acme Corp", "title": "Software Engineer" }
    ],
    "skills": ["JavaScript", "React", "Node.js"],
    "custom": {
      "desired_salary": "$140,000"
    }
  }
}
```

#### Expected Response Body from `/api/match`
```json
{
  "results": [
    {
      "fieldId": "field_1_first_name_text",
      "status": "matched",
      "value": "John",
      "confidence": 0.98,
      "isOpenEnded": false
    },
    {
      "fieldId": "field_8_notes_textarea",
      "status": "ambiguous",
      "value": "Experienced engineer interested in remote software roles.",
      "confidence": 0.65,
      "isOpenEnded": true
    },
    {
      "fieldId": "field_9_security_clearance_text",
      "status": "no_match",
      "value": null,
      "confidence": 0,
      "isOpenEnded": false
    }
  ]
}
```

---

## 3. Integration with Member 3 (Popup UI / frontend-ui)

Member 3 can interact with the Content Script and Service Worker by sending standard Chrome runtime messages.

### Message 1: Scan Current Webpage
Triggers field detection on the active webpage tab.

```javascript
// From Popup:
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const response = await chrome.tabs.sendMessage(tab.id, {
  type: 'FILLX_SCAN_PAGE'
});

// Response:
// {
//   success: true,
//   fields: [ { fieldId, name, type, tagName, label, placeholder, ... } ],
//   stats: {
//     totalFields: 10,
//     matchedCount: 0,
//     ambiguousCount: 0,
//     unmatchedCount: 0,
//     fieldsNeedAttention: 0
//   }
// }
```

### Message 2: Trigger Full Autofill
Triggers matching and field population on the active tab.

```javascript
// From Popup:
const response = await chrome.runtime.sendMessage({
  type: 'FILLX_AUTOFILL_PAGE',
  payload: {
    // Optional custom profile override; if omitted, background loads profile from storage
  }
});

// Response:
// {
//   success: true,
//   results: [ ... ],
//   fillOutcome: {
//     success: true,
//     filledCount: 7,
//     processedCount: 9,
//     stats: {
//       totalFields: 9,
//       matchedCount: 7,
//       ambiguousCount: 1,
//       unmatchedCount: 1,
//       fieldsNeedAttention: 2
//     }
//   }
// }
```

### Message 3: Get Field State & Attention Counter
Queries current counts for displaying in the popup UI badge.

```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const response = await chrome.tabs.sendMessage(tab.id, {
  type: 'FILLX_GET_PAGE_STATUS'
});

// Response:
// {
//   success: true,
//   stats: {
//     totalFields: 9,
//     matchedCount: 7,
//     ambiguousCount: 1,
//     unmatchedCount: 1,
//     fieldsNeedAttention: 2  // <-- ambiguousCount + unmatchedCount
//   },
//   fields: [ ... ]
// }
```

### Message 4: Clear Highlights
Clears all visual overlays, outlines, and badges from the page.

```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const response = await chrome.tabs.sendMessage(tab.id, {
  type: 'FILLX_CLEAR_HIGHLIGHTS'
});
```

---

## 4. Integration with Member 4 (Data & Deployment)

1. **Storage Schema Compatibility**:
   - Background worker reads the `profile` key from `chrome.storage.local` per Member 4's `storage-schema.md`.
2. **Save Custom Field Integration**:
   - When the user manually fills an unmatched field and blurs out of it, Member 1's engine attaches Member 4's `attachSavePrompts` or fallback prompt.
   - User clicking "Yes, save" sends message:
     ```javascript
     chrome.runtime.sendMessage({
       type: 'SAVE_CUSTOM_FIELD',
       payload: { key: 'desired_salary', value: '$140,000' }
     });
     ```
   - Service worker saves the value into `chrome.storage.local.get(['profile', 'fieldCache'])`.

---

## 5. How to Load and Test the Extension

### In Chrome Developer Mode
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in upper right).
3. Click **Load unpacked**.
4. Select the repository root folder:
   `C:\Users\Shop 94 Stadium SKP\.gemini\antigravity\scratch\FillX`
5. The extension "FillX - AI-Powered Autofill" is now installed.

### Testing on the Benchmark Test Form
1. Open the file in Chrome:
   `test/testForms.html`
2. Click **"Run Automated Unit Tests"** to verify all 8 test suites pass.
3. Click **"Execute Mock Autofill"** to see instant matched (green), ambiguous (amber), and unmatched (red) field highlighting.
4. Open the extension popup from the Chrome toolbar to view live attention counts.
