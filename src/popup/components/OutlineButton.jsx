import React from 'react';
import './OutlineButton.css';

export default function OutlineButton({ children, icon: Icon, onClick, className = '', disabled = false, type = 'button' }) {
  return (
    <button 
      className={`outline-button ${className}`} 
      onClick={onClick} 
      disabled={disabled}
      type={type}
    >
      {Icon && <Icon className="button-icon" size={18} strokeWidth={2} />}
      <span className="button-text">{children}</span>
    </button>
  );
}
