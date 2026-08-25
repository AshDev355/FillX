import React from 'react';
import { FileText } from 'lucide-react';

export default function FileInfoCard() {
  return (
    <div className="file-info-card">
      <span className="file-icon"><FileText size={21} strokeWidth={2} /></span>
      <span className="file-copy"><strong>resume_2026.pdf</strong><small>2.4 MB <b>•</b> PDF Document</small></span>
    </div>
  );
}