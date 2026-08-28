# AI Autofill Backend

This is the Next.js API backend for the AI Autofill Chrome extension. It uses the Google Gemini API to extract structured profiles, match form fields, and generate open-ended answers.

## Getting Started

1. **Set up environment variables:**
   Create a `.env.local` file in the root of the project and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3000`.

## Deployment

Deploy this project easily to Vercel:
```bash
npx vercel
```
Remember to add the `GEMINI_API_KEY` to your Vercel project environment variables.

## API Routes

### 1. `GET /api/ping`
Verifies that the backend is running.

**Example `curl`:**
```bash
curl http://localhost:3000/api/ping
```

### 2. `POST /api/extract`
Extracts personal data from raw text.

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"documentText": "John Doe. Software Engineer. Email: john@example.com. Phone: 123-456-7890."}'
```

### 3. `POST /api/match`
Matches form fields to user profile data.

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/api/match \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [{"id": "f1", "label": "Full Name", "placeholder": "", "name": "fullname", "type": "text"}],
    "profile": {"name": "John Doe", "email": "john@example.com"}
  }'
```

### 4. `POST /api/generate`
Generates a response for an open-ended question based on user keywords and profile.

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Why are you a good fit for this role?",
    "keywords": "leadership, problem solving",
    "profile": {"experience": [{"title": "Manager", "company": "Tech Corp"}]}
  }'
```
