import React from 'react';
import { Edit3 } from 'lucide-react';

export default function UploadOptionCard({ onClick }) {
  return (
    <button type="button" className="upload-option-card" onClick={onClick}>
      <span className="option-icon">
        <Edit3 size={17} strokeWidth={2} />
      </span>
      <div className="option-copy">
        <strong>FILL OUT MANUALLY</strong>
        <small>Answer a few questions to build your profile.</small>
      </div>
    </button>
  );
}
