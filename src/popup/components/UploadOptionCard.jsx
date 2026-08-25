import React from 'react';
import { Pencil } from 'lucide-react';

export default function UploadOptionCard({ onClick }) {
  return (
    <button className="upload-option-card" onClick={onClick}>
      <span className="option-icon"><Pencil size={18} strokeWidth={2.2} /></span>
      <span className="option-copy"><strong>FILL OUT MANUALLY</strong><small>Answer a few questions to build your profile.</small></span>
    </button>
  );
}