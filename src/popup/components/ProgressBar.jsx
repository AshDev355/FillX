import React from 'react';

export default function ProgressBar({ percentage }) {
  return (
    <div className="progress-area" aria-label={`${percentage}% complete`}>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${percentage}%` }} /></div>
      <span className="progress-label">{percentage}% COMPLETE</span>
    </div>
  );
}