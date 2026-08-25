import React from 'react';
import { ArrowLeft, MoreVertical, FileText } from 'lucide-react';
import './PopupHeader.css';

import { useState } from 'react';

export default function PopupHeader({ showBack = false, onBack, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="popup-header">
      <div className="header-left">
        {showBack ? (
          <button 
            className="icon-btn back-btn" 
            onClick={onBack}
            aria-label="Go back to home"
          >
            <ArrowLeft size={20} color="#242530" />
          </button>
        ) : (
          <div className="brand-logo-group">
            <div className="header-icon-badge">
              <FileText size={16} color="#4A0E0E" strokeWidth={2.2} />
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
          <MoreVertical size={20} color="#857A79" />
        </button>
        {menuOpen && (
          <div className="overflow-menu">
            <button onClick={() => { onNavigate.showUpload(); setMenuOpen(false); }}>New upload</button>
            <button onClick={() => { onNavigate.showHistory(); setMenuOpen(false); }}>View history</button>
            <button onClick={() => { onNavigate.showSettings(); setMenuOpen(false); }}>Settings</button>
          </div>
        )}
      </div>
    </header>
  );
}
