# chrome.storage.local — Storage Schema (Member 4)

## Top-Level Keys

| Key | Type | Description |
|-----|------|-------------|
| `profile` | `ProfileData` object | The user's extracted + manually edited data |
| `settings` | `Settings` object | App-level preferences |
| `fieldCache` | `FieldCache` object | Saved answers for previously filled custom fields |

---

## `profile` Object Shape

```json
{
  "profile": {
    "meta": {
      "lastUpdated": "2024-01-15T10:30:00Z",
      "sourceFileName": "john_doe_resume.pdf",
      "version": 1
    },
    "personal": {
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john.doe@email.com",
      "phone": "+1-555-123-4567",
      "dateOfBirth": "1990-05-15",
      "nationality": "American"
    },
    "address": {
      "street": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "country": "United States"
    },
    "education": [
      {
        "institution": "State University",
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "startYear": "2008",
        "endYear": "2012",
        "gpa": "3.8"
      }
    ],
    "experience": [
      {
        "company": "Tech Corp",
        "title": "Software Engineer",
        "startDate": "2012-06",
        "endDate": "2016-08",
        "description": "Developed web applications using React and Node.js"
      }
    ],
    "skills": ["JavaScript", "React", "Python", "SQL"],
    "languages": ["English", "Spanish"],
    "links": {
      "linkedin": "https://linkedin.com/in/johndoe",
      "github": "https://github.com/johndoe",
      "portfolio": "https://johndoe.dev"
    },
    "custom": {}
  }
}
```

## `fieldCache` Object Shape

Stores user-confirmed answers for fields that weren't matched from the profile.

```json
{
  "fieldCache": {
    "desiredSalary": "85000",
    "coverLetterSummary": "Passionate engineer with 5+ years...",
    "referralSource": "LinkedIn"
  }
}
```

## `settings` Object Shape

```json
{
  "settings": {
    "highlightMatched": true,
    "highlightAmbiguous": true,
    "highlightUnmatched": true,
    "autoPromptSave": true
  }
}
```
