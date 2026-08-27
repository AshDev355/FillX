/**
 * OnboardingScreen.jsx — 3-Step Initial Profile Setup Wizard
 *
 * Guides newly registered + email-verified users through required and optional
 * profile fields, persists the profile to chrome.storage.local, and marks
 * onboardingCompleted = true to unlock the main autofill dashboard.
 *
 * Steps:
 *   1 — Personal & Contact (required: first name, last name, email, phone)
 *   2 — Address & Professional Background (required: address; optional: job, education)
 *   3 — Online Profiles & Links (optional: LinkedIn, GitHub, Portfolio, skills, summary)
 */

import React, { useState } from 'react';
import {
  ArrowRight, ArrowLeft, Check, MapPin, Briefcase,
  GraduationCap, Link2, AlertCircle, User,
} from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton.jsx';
import OutlineButton from '../components/OutlineButton.jsx';
import { setProfile, getProfile } from '../../utils/storage.js';
import { completeOnboarding } from '../../utils/auth.js';

// ─── Inline validation ────────────────────────────────────────────────────────
function validate(formData, step) {
  const errs = {};
  if (step === 1) {
    if (!formData.firstName.trim()) errs.firstName = 'First name is required.';
    if (!formData.lastName.trim())  errs.lastName  = 'Last name is required.';
    if (!formData.email.trim() || !formData.email.includes('@'))
      errs.email = 'A valid email is required.';
    if (!formData.phone.trim())     errs.phone     = 'Phone number is required.';
  }
  if (step === 2) {
    if (!formData.street.trim())  errs.street  = 'Street address is required.';
    if (!formData.city.trim())    errs.city    = 'City is required.';
    if (!formData.country.trim()) errs.country = 'Country is required.';
    if (!formData.zip.trim())     errs.zip     = 'ZIP / Postal code is required.';
  }
  return errs;
}

// ─── Small reusable form field ────────────────────────────────────────────────
function Field({ label, id, error, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error && (
        <p style={{ fontSize: 10, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Step progress indicator ──────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive  = step === current;
        const isDone    = step < current;
        const labels    = ['Required', 'Address', 'Links'];
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                className={`step-bubble ${isActive || isDone ? 'active' : ''}`}
                style={isDone ? { background: '#059669', borderColor: '#059669', color: '#fff' } : undefined}
              >
                {isDone ? <Check size={11} /> : step}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                display: current <= 2 || step <= total ? 'inline' : 'none',
              }}>
                {labels[i]}
              </span>
            </div>
            {step < total && (
              <div className={`step-line ${step < current ? 'active' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OnboardingScreen({ initialUser, onComplete }) {
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    // Step 1 — Required personal
    firstName:       initialUser?.name?.split(' ')[0]              || '',
    lastName:        initialUser?.name?.split(' ').slice(1).join(' ') || '',
    email:           initialUser?.email                             || '',
    phone:           '',
    // Step 2 — Address (required) + Professional (optional)
    street:          '',
    city:            '',
    state:           '',
    country:         '',
    zip:             '',
    company:         '',
    title:           '',
    yearsExperience: '',
    degree:          '',
    institution:     '',
    gradYear:        '',
    // Step 3 — Links + extras (optional)
    linkedin:        '',
    github:          '',
    portfolio:       '',
    skills:          '',
    summary:         '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for that field on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  // ── Step navigation ──────────────────────────────────────────────────────
  const handleNext = (e) => {
    e.preventDefault();
    const errs = validate(formData, step);
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setFieldErrors({});
    setStep((s) => s - 1);
  };

  // ── Final save ────────────────────────────────────────────────────────────
  const handleFinish = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const existing = await getProfile();
      const skillsArray = formData.skills
        ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const updatedProfile = {
        ...existing,
        personal: {
          ...existing.personal,
          firstName: formData.firstName.trim(),
          lastName:  formData.lastName.trim(),
          fullName:  `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          email:     formData.email.trim(),
          phone:     formData.phone.trim(),
        },
        address: {
          ...existing.address,
          street:  formData.street.trim(),
          city:    formData.city.trim(),
          state:   formData.state.trim(),
          zip:     formData.zip.trim(),
          country: formData.country.trim(),
        },
        experience: [
          {
            company: formData.company.trim(),
            title:   formData.title.trim(),
            years:   formData.yearsExperience.trim(),
          },
        ],
        education: [
          {
            degree:      formData.degree.trim(),
            institution: formData.institution.trim(),
            endYear:     formData.gradYear.trim(),
          },
        ],
        links: {
          linkedin:  formData.linkedin.trim(),
          github:    formData.github.trim(),
          portfolio: formData.portfolio.trim(),
        },
        skills: skillsArray.length > 0 ? skillsArray : existing.skills,
        custom: {
          ...(existing.custom || {}),
          ...(formData.summary ? { summary: formData.summary.trim() } : {}),
        },
      };

      await setProfile(updatedProfile, 'onboarding_setup');
      await completeOnboarding();
      if (onComplete) onComplete(updatedProfile);
    } catch (err) {
      console.error('FillX Onboarding save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const headings = [
    'Personal & Contact Details',
    'Address & Experience',
    'Online Profiles & Skills',
  ];
  const subheadings = [
    'Required fields used to match standard contact forms accurately.',
    'Your address (required) plus work & education details (optional).',
    'Optional links and skills for smarter application autofilling.',
  ];

  return (
    <div className="onboarding-container onboarding-scroll">
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <p className="eyebrow-text">SETUP WIZARD — STEP {step} OF {TOTAL_STEPS}</p>
        <h1 className="font-display" style={{ fontSize: 17, marginBottom: 4 }}>
          {headings[step - 1]}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subheadings[step - 1]}</p>
      </div>

      <StepIndicator current={step} total={TOTAL_STEPS} />

      {/* ── STEP 1: Personal & Contact ── */}
      {step === 1 && (
        <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="First Name *" id="onb-fn" error={fieldErrors.firstName}>
              <input
                id="onb-fn" name="firstName" type="text" required
                placeholder="Alex" value={formData.firstName} onChange={handleChange}
                style={{ borderColor: fieldErrors.firstName ? '#dc2626' : undefined }}
              />
            </Field>
            <Field label="Last Name *" id="onb-ln" error={fieldErrors.lastName}>
              <input
                id="onb-ln" name="lastName" type="text" required
                placeholder="Morgan" value={formData.lastName} onChange={handleChange}
                style={{ borderColor: fieldErrors.lastName ? '#dc2626' : undefined }}
              />
            </Field>
          </div>

          <Field label="Email Address *" id="onb-email" error={fieldErrors.email}>
            <div style={{ position: 'relative' }}>
              <input
                id="onb-email" name="email" type="email" required
                placeholder="alex@example.com" value={formData.email} onChange={handleChange}
                style={{ borderColor: fieldErrors.email ? '#dc2626' : undefined, width: '100%' }}
              />
            </div>
          </Field>

          <Field label="Phone Number *" id="onb-phone" error={fieldErrors.phone}>
            <input
              id="onb-phone" name="phone" type="tel" required
              placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange}
              style={{ borderColor: fieldErrors.phone ? '#dc2626' : undefined }}
            />
          </Field>

          <PrimaryButton type="submit" icon={ArrowRight} style={{ marginTop: 10 }}>
            NEXT: ADDRESS & EXPERIENCE
          </PrimaryButton>
        </form>
      )}

      {/* ── STEP 2: Address + Professional ── */}
      {step === 2 && (
        <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Address section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)', marginBottom: 2 }}>
            <MapPin size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Current Address *</span>
          </div>

          <Field label="" id="onb-street" error={fieldErrors.street}>
            <input
              id="onb-street" name="street" type="text" required
              placeholder="Street Address (e.g. 123 Main St)"
              value={formData.street} onChange={handleChange}
              style={{ borderColor: fieldErrors.street ? '#dc2626' : undefined }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 6 }}>
            <Field label="" id="onb-city" error={fieldErrors.city}>
              <input
                id="onb-city" name="city" type="text" required
                placeholder="City" value={formData.city} onChange={handleChange}
                style={{ borderColor: fieldErrors.city ? '#dc2626' : undefined, flex: 1 }}
              />
            </Field>
            <Field label="" id="onb-state" error={fieldErrors.state}>
              <input
                id="onb-state" name="state" type="text"
                placeholder="State / Province" value={formData.state} onChange={handleChange}
                style={{ flex: 1 }}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <Field label="" id="onb-zip" error={fieldErrors.zip}>
              <input
                id="onb-zip" name="zip" type="text" required
                placeholder="ZIP / Postal Code" value={formData.zip} onChange={handleChange}
                style={{ borderColor: fieldErrors.zip ? '#dc2626' : undefined, flex: 1 }}
              />
            </Field>
            <Field label="" id="onb-country" error={fieldErrors.country}>
              <input
                id="onb-country" name="country" type="text" required
                placeholder="Country" value={formData.country} onChange={handleChange}
                style={{ borderColor: fieldErrors.country ? '#dc2626' : undefined, flex: 1 }}
              />
            </Field>
          </div>

          {/* Work experience section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)', marginTop: 4 }}>
            <Briefcase size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Work Experience (Optional)</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              name="company" type="text"
              placeholder="Current Company" value={formData.company} onChange={handleChange}
              style={{ flex: 1, fontSize: 11 }}
            />
            <input
              name="title" type="text"
              placeholder="Job Title" value={formData.title} onChange={handleChange}
              style={{ flex: 1, fontSize: 11 }}
            />
          </div>

          {/* Education section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)', marginTop: 4 }}>
            <GraduationCap size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Education (Optional)</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              name="institution" type="text"
              placeholder="University / College" value={formData.institution} onChange={handleChange}
              style={{ flex: 1, fontSize: 11 }}
            />
            <input
              name="degree" type="text"
              placeholder="Degree (e.g. B.S. CS)" value={formData.degree} onChange={handleChange}
              style={{ flex: 1, fontSize: 11 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <OutlineButton type="button" icon={ArrowLeft} onClick={handleBack} style={{ flex: 1 }}>
              BACK
            </OutlineButton>
            <PrimaryButton type="submit" icon={ArrowRight} style={{ flex: 2 }}>
              NEXT: LINKS & SKILLS
            </PrimaryButton>
          </div>
        </form>
      )}

      {/* ── STEP 3: Links + Skills + Summary ── */}
      {step === 3 && (
        <form onSubmit={handleFinish} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)', marginBottom: 2 }}>
            <Link2 size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Online Profiles (Optional)</span>
          </div>

          <Field label="LinkedIn URL" id="onb-linkedin">
            <input
              id="onb-linkedin" name="linkedin" type="url"
              placeholder="https://linkedin.com/in/yourname"
              value={formData.linkedin} onChange={handleChange}
            />
          </Field>

          <Field label="GitHub URL" id="onb-github">
            <input
              id="onb-github" name="github" type="url"
              placeholder="https://github.com/yourname"
              value={formData.github} onChange={handleChange}
            />
          </Field>

          <Field label="Portfolio / Website" id="onb-portfolio">
            <input
              id="onb-portfolio" name="portfolio" type="url"
              placeholder="https://yoursite.com"
              value={formData.portfolio} onChange={handleChange}
            />
          </Field>

          <Field label="Key Skills (Comma Separated)" id="onb-skills">
            <input
              id="onb-skills" name="skills" type="text"
              placeholder="React, TypeScript, Project Management"
              value={formData.skills} onChange={handleChange}
            />
          </Field>

          <Field label="Professional Summary / Bio" id="onb-summary">
            <textarea
              id="onb-summary" name="summary" rows={3}
              placeholder="Brief overview of your experience and career goals..."
              value={formData.summary} onChange={handleChange}
              style={{ resize: 'vertical', fontSize: 11 }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <OutlineButton type="button" icon={ArrowLeft} onClick={handleBack} style={{ flex: 1 }}>
              BACK
            </OutlineButton>
            <PrimaryButton type="submit" disabled={loading} icon={Check} style={{ flex: 2 }}>
              {loading ? 'SAVING PROFILE...' : 'COMPLETE SETUP'}
            </PrimaryButton>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-text-muted)', fontSize: 10,
              cursor: 'pointer', textAlign: 'center', marginTop: 2,
            }}
          >
            Skip optional fields →
          </button>
        </form>
      )}
    </div>
  );
}
