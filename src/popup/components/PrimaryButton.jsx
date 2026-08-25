import React from 'react';
import './PrimaryButton.css';

export default function PrimaryButton({ children, icon: Icon, onClick, className = '', disabled = false, type = 'button' }) {
  return (
    <button 
      className={`primary-button ${className}`} 
      onClick={onClick} 
      disabled={disabled}
      type={type}
    >
      {Icon && <Icon className="button-icon" size={18} strokeWidth={2.2} />}
      <span className="button-text">{children}</span>
    </button>
  );
}
