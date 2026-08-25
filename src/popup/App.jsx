import React, { useState } from 'react';
import PopupHeader from './components/PopupHeader';
import BottomNav from './components/BottomNav';
import UploadPromptScreen from './screens/UploadPromptScreen';
import DocumentSelectScreen from './screens/DocumentSelectScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import DataPreviewScreen from './screens/DataPreviewScreen';
import ManualFormScreen from './screens/ManualFormScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import './theme.css';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('upload');
  const [editingExtracted, setEditingExtracted] = useState(false);
  const [history, setHistory] = useState([
    { type: 'DOCUMENT', title: 'resume_2026.pdf', meta: 'Extracted just now', status: 'READY' },
    { type: 'FORM', title: 'Personal profile', meta: 'Completed October 18, 2023', status: 'SAVED' },
    { type: 'DOCUMENT', title: 'invoice_october.pdf', meta: 'Processed October 12, 2023', status: 'READY' },
  ]);
  const showUpload = () => setActiveScreen('upload');
  const showHistory = () => setActiveScreen('history');
  const showSettings = () => setActiveScreen('settings');
  const handleUpload = () => {
    // TODO: wire file upload handler to the selected document.
    setActiveScreen('select');
  };
  const handleManualStart = () => { setEditingExtracted(false); setActiveScreen('manual'); };
  const handleDocumentUpload = () => setActiveScreen('processing');
  const handleManualSave = (profile) => {
    setHistory((items) => [{ type: 'FORM', title: profile.fullName || 'Personal profile', meta: 'Completed just now', status: 'SAVED' }, ...items]);
    setActiveScreen('history');
  };
  const finishExtraction = () => setActiveScreen('preview');
  const navigateBack = () => {
    if (activeScreen === 'select' || activeScreen === 'manual' || activeScreen === 'history' || activeScreen === 'settings') showUpload();
    else if (activeScreen === 'preview') setActiveScreen('select');
    else showUpload();
  };
  const activeTab = activeScreen === 'history' ? 'history' : activeScreen === 'settings' ? 'settings' : 'upload';

  return (
    <div className="app-container">
      <PopupHeader showBack={activeScreen !== 'upload'} onBack={navigateBack} onNavigate={{ showUpload, showHistory, showSettings }} />
      <main className={`main-content screen-${activeScreen}`}>
        {activeScreen === 'upload' && <UploadPromptScreen onUpload={handleUpload} onManual={handleManualStart} />}
        {activeScreen === 'select' && <DocumentSelectScreen onUpload={handleDocumentUpload} onBack={showUpload} />}
        {activeScreen === 'processing' && <ProcessingScreen onComplete={finishExtraction} />}
        {activeScreen === 'preview' && <DataPreviewScreen onEdit={() => { setEditingExtracted(true); setActiveScreen('manual'); }} onSave={showHistory} />}
        {activeScreen === 'manual' && <ManualFormScreen editingExtracted={editingExtracted} onSave={handleManualSave} onBack={() => editingExtracted ? setActiveScreen('preview') : showUpload()} />}
        {activeScreen === 'history' && <HistoryScreen history={history} />}
        {activeScreen === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => tab === 'upload' ? showUpload() : tab === 'history' ? showHistory() : showSettings()} />
    </div>
  );
}