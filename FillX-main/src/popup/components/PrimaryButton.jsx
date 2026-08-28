import React from 'react';

export default function PrimaryButton({ children, icon: Icon, onClick, disabled = false, type = 'button' }) {
  return (
    <button
      type={type}
      className="btn-primary"
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
