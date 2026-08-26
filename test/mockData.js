/**
 * mockData.js — Test Profile & Mock Matching Responses for FillX
 *
 * Provides realistic test data matching the storage schema and API contracts.
 */

export const MOCK_USER_PROFILE = {
  meta: {
    sourceFileName: 'john_doe_resume.pdf',
    version: 1,
    lastUpdated: '2026-08-26T12:00:00.000Z',
  },
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'Johnathan Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 234-5678',
    dateOfBirth: '1995-06-15',
    nationality: 'American',
  },
  address: {
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'Oregon',
    zip: '97477',
    country: 'United States',
  },
  education: [
    {
      school: 'Springfield University',
      degree: 'B.S. in Computer Science',
      year: '2017',
    },
  ],
  experience: [
    {
      company: 'Acme Software Corp',
      title: 'Senior Frontend Developer',
      startDate: '2020-01',
      endDate: '2024-05',
      description: 'Built modern web applications using React, TypeScript, and Chrome Extensions.',
    },
  ],
  skills: ['JavaScript', 'React', 'Node.js', 'Chrome Extensions', 'HTML/CSS', 'Python'],
  languages: ['English', 'Spanish'],
  links: {
    linkedin: 'https://linkedin.com/in/johndoe-dev',
    github: 'https://github.com/johndoe-dev',
    portfolio: 'https://johndoe.dev',
  },
  custom: {
    desired_salary: '$140,000',
    preferred_work_arrangement: 'Remote',
    notice_period: '2 weeks',
  },
};

export const MOCK_MATCHING_RESULTS_SAMPLE = [
  {
    fieldId: 'field_1_first_name_text',
    status: 'matched',
    value: 'John',
    confidence: 0.98,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_2_last_name_text',
    status: 'matched',
    value: 'Doe',
    confidence: 0.98,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_3_email_email',
    status: 'matched',
    value: 'john.doe@example.com',
    confidence: 0.99,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_4_phone_tel',
    status: 'matched',
    value: '+1 (555) 234-5678',
    confidence: 0.95,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_5_street_text',
    status: 'matched',
    value: '742 Evergreen Terrace',
    confidence: 0.92,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_6_city_text',
    status: 'matched',
    value: 'Springfield',
    confidence: 0.94,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_7_country_select',
    status: 'matched',
    value: 'United States',
    confidence: 0.96,
    isOpenEnded: false,
  },
  {
    fieldId: 'field_8_notes_textarea',
    status: 'ambiguous',
    value: 'Experienced software engineer seeking remote opportunities.',
    confidence: 0.65,
    isOpenEnded: true,
  },
  {
    fieldId: 'field_9_security_clearance_text',
    status: 'no_match',
    value: null,
    confidence: 0,
    isOpenEnded: false,
  },
];
