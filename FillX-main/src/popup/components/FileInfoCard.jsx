import React from 'react';
import { FileText } from 'lucide-react';

export default function FileInfoCard({ fileName = 'resume_2026.pdf', fileSize = '2.4 MB · PDF Document' }) {
  return (
    <div className="file-info-card">
      <span className="file-icon">
        <FileText size={20} strokeWidth={2} />
      </span>
      <div className="file-copy">
        <strong>{fileName}</strong>
        <small>{fileSize}</small>
      </div>
    </div>
  );
}
