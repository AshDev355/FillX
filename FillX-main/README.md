# FillX — AI-Powered Intelligent Autofill Chrome Extension

> **Unified, Production-Ready Manifest V3 Chrome Extension** designed to eliminate repetitive web form filing using structured data extracted from a single source document.

---

## Key Features

1. **Document Upload & AI Extraction**:
   - One-time document upload (`.pdf`, `.txt`, `.md`, `.json`, `.docx`).
   - Extracts structured profile schema (Name, Email, Phone, Address, Education, Work Experience, Skills, Social Links).
   - Seamless offline fallback parser when backend is unreachable.

2. **Full Profile Management**:
   - Local browser storage (`chrome.storage.local`).
   - View, edit, add, or delete personal details, address info, education, experience, and custom fields.
   - Dynamic real-time persistence.

3. **Smart DOM Field Matching**:
   - Traverses standard and non-standard form fields (`<input>`, `<textarea>`, `<select>`, `[contenteditable]`).
   - Contextual clue scoring across `id`, `name`, `<label for>`, enclosing labels, `aria-labelledby`, `aria-label`, and nearby text.
   - Integrates with Gemini LLM (`/api/match`) + high-precision local heuristic matching engine.

4. **Visual Field Status Highlighting**:
   - 🟢 **Green**: Confidently matched & auto-filled (`✓ 98%` or `✓ Matched`).
   - 🟡 **Amber**: Ambiguous match (auto-filled, flagged for user review `⚠ Review`).
   - 🔴 **Dashed Red**: Unmatched (strictly blank, flagged `✕ Unmatched`).
   - Floating status badges positioned dynamically with non-destructive, reversible styling.

5. **Strict No-Hallucination Policy**:
   - Factual fields with missing data are left **strictly blank**. The system never invents facts or fake values.

6. **"Save for Later" Field Feedback Loop**:
   - When a user manually fills an unmatched field and moves focus (`blur`), an interactive prompt appears: *"Save '[field]' to your profile?"*.
   - Confirmed entries are saved to `profile.custom` and `fieldCache` for automatic matching in future forms.

7. **Keyword Essay / Open-Ended Answer Generator**:
   - Detects textareas and long-text essay questions (*"Why are you a good fit?"*, *"Describe your experience"*).
   - Injects a floating **"✨ Generate answer"** trigger.
   - User enters 2–3 keywords; the extension generates a tailored, professional response utilizing their background context.

8. **Manual Submit Safety Guarantee**:
   - The extension **never** programmatically calls `form.submit()` or clicks submit buttons. Final review and submission remain strictly with the user.

---

## Directory Structure

```text
FillX/
├── manifest.json                  # Manifest V3 Extension Configuration
├── package.json                   # Root package & build scripts
├── vite.config.js                 # Vite bundler configuration
├── build.js                       # Standalone zero-dependency Content Script bundler
├── popup.html                     # Popup HTML template
├── icons/                         # 16x16, 48x48, 128x128 icons
├── dist/                          # Production compiled assets
│   ├── popup.html                 # Compiled React Popup App
│   ├── contentScript.bundle.js    # Bundled standalone content script
│   └── highlighter.css            # Extension visual styles
├── src/
│   ├── background/
│   │   └── serviceWorker.js       # Service worker router & badge manager
│   ├── content/
│   │   ├── contentScript.js       # Main content script entry point
│   │   ├── autofillEngine.js      # Core autofill execution & safety guards
│   │   ├── fieldDetector.js       # DOM traversal & context clue resolver
│   │   ├── fieldIdentifier.js     # DOM element <-> fieldId registry
│   │   ├── fieldState.js          # In-memory field stats & attention math
│   │   ├── highlighter.js         # Non-destructive green/amber/red highlighter
│   │   ├── highlighter.css        # Highlighter & badge stylesheets
│   │   ├── dynamicObserver.js     # MutationObserver for SPAs & dynamic forms
│   │   ├── openEndedGenerator.js  # Floating "✨ Generate answer" button & modal
│   │   └── savePromptBridge.js    # Unmatched field blur "Save for later" feedback loop
│   ├── popup/
│   │   ├── main.jsx               # React entry point
│   │   ├── App.jsx                # Main tab controller & state management
│   │   ├── theme.css              # Dark-mode design system & animations
│   │   ├── components/            # UI components (Header, Nav, Buttons, Cards)
│   │   └── screens/               # Popup screens (FillDashboard, Upload, Profile, History, Settings)
│   ├── shared/
│   │   └── messageTypes.js        # Standardized message contracts & enums
│   └── utils/
│       ├── storage.js             # chrome.storage.local schema & CRUD methods
│       ├── matchingHeuristics.js  # Contextual matching & confidence scorer
│       ├── documentParser.js      # Document text parser & extraction router
│       └── pdfExtractor.js        # Client-side PDF stream text parser
├── test/
│   ├── testForms.html             # Interactive benchmark forms test harness
│   ├── mockData.js                # Canonical mock profile & matching samples
│   ├── unitTests.test.js          # Automated Node.js test suite
│   └── testRunner.js              # In-browser test runner
└── FillX-APIs/                    # Next.js Gemini LLM backend server
    ├── app/api/
    │   ├── extract/route.js       # Document AI extraction endpoint
    │   ├── match/route.js         # Intelligent field matching endpoint
    │   ├── generate/route.js      # Open-ended essay generation endpoint
    │   └── ping/route.js          # Health check endpoint
    └── lib/prompts.js             # AI prompt engineering templates
```

---

## Getting Started

### 1. Build the Extension
In the project root, install dependencies and run the build:
```bash
npm install
npm run build
```
This compiles the content script bundle into `dist/contentScript.bundle.js` and builds the React Popup into `dist/popup.html`.

### 2. Run Automated Unit Tests
```bash
npm test
```
Runs the automated test suite verifying message contracts, label normalizations, heuristic matching rules, strict safety assertions, and attention counter math.

### 3. Load in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `FillX` root directory (`c:\Users\User\Downloads\FillX`).
5. Pin the **FillX** extension to your toolbar.

### 4. (Optional) Run the Next.js AI Backend
To enable Gemini-powered document extraction and matching:
```bash
cd FillX-APIs/FillX-APIs
npm install
# Set GEMINI_API_KEY in .env.local
npm run dev
```
*(Note: If the backend is not running, FillX seamlessly uses its built-in heuristic matching engine and local parser.)*

### 5. Open the Test Harness
Open `test/testForms.html` in Chrome to test autofill across multiple form layouts (Standard Personal, Address Selects, React/Vue Controlled inputs, Ambiguous Textareas, and Dynamic Field additions).
