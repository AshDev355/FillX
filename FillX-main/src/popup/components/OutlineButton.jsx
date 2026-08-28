import React from 'react';

export default function OutlineButton({ children, icon: Icon, onClick, disabled = false, type = 'button', style }) {
  return (
    <button
      type={type}
      className="btn-outline"
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
