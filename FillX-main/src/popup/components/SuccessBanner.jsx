import React from 'react';
import { Check } from 'lucide-react';

export default function SuccessBanner({ title = 'Extraction Complete', subtitle = 'Personal Profile' }) {
  return (
    <div className="success-banner">
      <span className="success-icon">
        <Check size={20} strokeWidth={2.5} />
      </span>
      <span>
        <small>{title}</small>
        <strong>{subtitle}</strong>
      </span>
    </div>
  );
}
