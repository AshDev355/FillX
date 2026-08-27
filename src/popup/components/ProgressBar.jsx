import React from 'react';

export default function ProgressBar({ percentage = 0 }) {
  const bounded = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div className="progress-area">
      <div className="progress-track" role="progressbar" aria-valuenow={bounded} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-fill" style={{ width: `${bounded}%` }} />
      </div>
      <span className="progress-label">{bounded}% COMPLETE</span>
    </div>
  );
}
