import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, FileText, User, Settings as SettingsIcon, LogOut } from 'lucide-react';
import './PopupHeader.css';

export default function PopupHeader({
  showBack = false,
  onBack,
  title = 'FillX',
  user = null,
  onSignOut,
  onNavigate,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="popup-header">
      <div className="header-left">
        {showBack ? (
          <button
            className="icon-btn back-btn"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft size={19} color="#242530" />
          </button>
        ) : (
          <div className="brand-logo-group">
            <div className="header-icon-badge">
              <FileText size={15} color="#4A0E0E" strokeWidth={2.2} />
            </div>
            <span className="brand-wordmark font-display">FillX</span>
          </div>
        )}
      </div>

      <div className="header-right">
        <button
          className="icon-btn overflow-menu-btn"
          aria-label="More options"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreVertical size={19} color="#857A79" />
        </button>

        {menuOpen && (
          <div className="overflow-menu">
            {onNavigate && (
              <>
                <button
                  onClick={() => {
                    onNavigate('fill');
                    setMenuOpen(false);
                  }}
                >
                  <FileText size={13} color="#4A0E0E" />
                  <span>Autofill Form</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('upload');
                    setMenuOpen(false);
                  }}
                >
                  <FileText size={13} color="#4A0E0E" />
                  <span>Upload Document</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('profile');
                    setMenuOpen(false);
                  }}
                >
                  <User size={13} color="#4A0E0E" />
                  <span>View Profile</span>
                </button>
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setMenuOpen(false);
                  }}
                >
                  <SettingsIcon size={13} color="#4A0E0E" />
                  <span>Settings</span>
                </button>
              </>
            )}
            {onSignOut && (
              <button
                onClick={() => {
                  onSignOut();
                  setMenuOpen(false);
                }}
                style={{ color: '#ef4444', borderTop: '1px solid var(--color-border)', marginTop: 4 }}
              >
                <LogOut size={13} color="#ef4444" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
