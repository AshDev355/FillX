import React from 'react';
import { Save, Pencil } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';
import SuccessBanner from '../components/SuccessBanner';
import ExtractedFieldCard from '../components/ExtractedFieldCard';

export default function DataPreviewScreen({ profile, onEdit, onSave }) {
  const p = profile || {};
  const personal = p.personal || {};
  const address = p.address || {};
  const skills = Array.isArray(p.skills) ? p.skills.join(', ') : (p.skills || '');
  const exp = Array.isArray(p.experience) && p.experience[0] ? p.experience[0] : {};

  const fields = [
    ['Full Name', personal.fullName || `${personal.firstName || ''} ${personal.lastName || ''}`.trim() || 'Alex Morgan', true],
    ['Email Address', personal.email || 'alex@example.com'],
    ['Phone Number', personal.phone || '+1 (555) 000-0000'],
    ['Street Address', address.street || '123 Main St'],
    ['City / Location', `${address.city || 'San Francisco'}${address.city && address.state ? ', ' : ''}${address.state || 'CA'}`],
    ['Recent Role', exp.title ? `${exp.title} at ${exp.company || 'Company'}` : 'Software Engineer'],
    ['Key Skills', skills || 'React, TypeScript, Node.js'],
  ];

  return (
    <section className="preview-screen">
      <div className="preview-scroll">
        <SuccessBanner
          title="Extraction Complete"
          subtitle={personal.fullName || 'Personal Profile'}
        />

        <p className="eyebrow-text preview-label">EXTRACTED DATA</p>

        <div className="fields-list">
          {fields.map(([label, value, emphasis]) => (
            <ExtractedFieldCard
              key={label}
              label={label}
              value={value}
              emphasis={emphasis}
            />
          ))}
        </div>
      </div>

      <div className="preview-actions">
        <PrimaryButton icon={Save} onClick={onSave}>
          SAVE &amp; CONTINUE
        </PrimaryButton>
        <OutlineButton icon={Pencil} onClick={onEdit}>
          EDIT MANUALLY
        </OutlineButton>
      </div>
    </section>
  );
}
