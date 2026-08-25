import React from 'react';
import { UploadCloud, History, Settings } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav({ activeTab = 'upload', onTabChange }) {
  const tabs = [
    { id: 'upload', label: 'UPLOAD', icon: UploadCloud },
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
                size={20} 
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
