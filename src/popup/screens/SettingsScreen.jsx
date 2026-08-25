import React from 'react';
import { Bell, ChevronRight, LockKeyhole, SlidersHorizontal } from 'lucide-react';

export default function SettingsScreen() {
  return <section className="settings-screen"><div className="screen-heading compact"><p className="eyebrow-text">PREFERENCES</p><h1 className="font-display">Settings</h1><p>Manage how FillX works for you.</p></div><div className="settings-list"><button><span><LockKeyhole size={18} /><strong>Privacy &amp; security</strong></span><ChevronRight size={16} /></button><button><span><Bell size={18} /><strong>Notifications</strong></span><ChevronRight size={16} /></button><button><span><SlidersHorizontal size={18} /><strong>Autofill preferences</strong></span><ChevronRight size={16} /></button></div></section>;
}