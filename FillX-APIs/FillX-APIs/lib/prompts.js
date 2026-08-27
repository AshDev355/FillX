export function buildExtractionPrompt(documentText) {
  return `You are a data extraction assistant. Your task is to extract personal and professional details from the provided document text into strict JSON format.
  
Do not include any prose, markdown formatting, or code fences (e.g., \`\`\`json). Return ONLY the raw JSON object.
Extract only the fields found in the text. Do not invent or guess any missing values.

The JSON should have the following structure:
{
  "name": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "dateOfBirth": "string (optional)",
  "education": [
    {
      "school": "string",
      "degree": "string",
      "year": "string"
    }
  ],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string"
    }
  ],
  "skills": ["string"]
}

Document Text:
${documentText}
`;
}

export function buildMatchingPrompt(fields, profile) {
  return `You are an AI assistant that matches user profile data to web form fields.
Your task is to analyze a list of form fields and match them to the provided user profile data.

CRITICAL RULE: NEVER invent or guess a value that isn't actually present in the profile data. If there is no reasonable match, it MUST be "no_match" with a null value.

For each field, classify it as one of:
- "matched": Confident match with a value from the profile.
- "ambiguous": Possible match but unsure.
- "no_match": Nothing in the profile covers it.

Additionally, detect if a field looks like an open-ended/essay question (e.g., long textarea, or label phrasing like "why", "describe", "tell us about"). If it is, flag it with "isOpenEnded": true.

Return ONLY a strict JSON object with this exact structure (no markdown fences, no prose):
{
  "results": [
    {
      "fieldId": "string",
      "status": "matched | ambiguous | no_match",
      "value": "string | null",
      "confidence": "number (0 to 1)",
      "isOpenEnded": "boolean (optional, include if true)"
    }
  ]
}

Form Fields:
${JSON.stringify(fields, null, 2)}

User Profile Data:
${JSON.stringify(profile, null, 2)}
`;
}

export function buildGenerationPrompt(question, keywords, profile) {
  return `You are an AI assistant helping a user answer an open-ended form question.
Your task is to write a professional, first-person response (3-5 sentences) to the question.

Incorporate the provided keywords and the user's profile context (like their job history or skills) naturally into the response. Do not just list the keywords verbatim. Do not include any markdown fences or introductory/concluding prose outside the answer itself.

Question:
${question}

User-supplied keywords:
${keywords}

User Profile Data:
${JSON.stringify(profile, null, 2)}

Return ONLY the generated paragraph as plain text.
`;
}
