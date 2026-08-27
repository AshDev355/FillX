import React from 'react';
import { Zap, UploadCloud, User, History, Settings } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav({ activeTab = 'fill', onTabChange }) {
  const tabs = [
    { id: 'fill', label: 'FILL', icon: Zap },
    { id: 'upload', label: 'UPLOAD', icon: UploadCloud },
    { id: 'profile', label: 'PROFILE', icon: User },
    { id: 'history', label: 'HISTORY', icon: History },
    { id: 'settings', label: 'SETTINGS', icon: Settings },
  ];

  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            className={`nav-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <div className="tab-icon-wrapper">
              <IconComponent
                size={18}
                color={isActive ? '#4A0E0E' : '#857A79'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </div>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
