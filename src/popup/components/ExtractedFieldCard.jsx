import React from 'react';

export default function ExtractedFieldCard({ label, value, emphasis = false }) {
  return (
    <div className={`extracted-field-card ${emphasis ? 'emphasis' : ''}`}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}
