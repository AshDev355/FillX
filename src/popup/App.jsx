import React, { useState, useEffect, useCallback } from 'react';
import PopupHeader from './components/PopupHeader';
import BottomNav from './components/BottomNav';
import FillDashboardScreen from './screens/FillDashboardScreen';
import UploadPromptScreen from './screens/UploadPromptScreen';
import DocumentSelectScreen from './screens/DocumentSelectScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import DataPreviewScreen from './screens/DataPreviewScreen';
import ProfileTab from './screens/ProfileTab';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { getProfile } from '../utils/storage';
import { getAuthSession, signOut } from '../utils/auth';
import './theme.css';

export default function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('fill');
  const [uploadStep, setUploadStep] = useState('prompt'); // 'prompt' | 'select' | 'processing' | 'preview'
  const [documentPayload, setDocumentPayload] = useState(null);
  const [extractedProfile, setExtractedProfile] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);

  // ── Load auth + profile ────────────────────────────────────────────────────
  const loadAuthAndProfile = useCallback(async () => {
    try {
      const session = await getAuthSession();
      const userEmail = session?.user?.email || null;
      const profile = await getProfile(userEmail);

      // Check onboarding completion strictly for this user's profile
      if (session.isAuthenticated && !session.isOnboarded) {
        if (profile?.meta?.onboardingCompleted === true) {
          session.isOnboarded = true;
        }
      }

      setAuthSession(session);
      setCurrentProfile(profile);
    } catch (err) {
      console.error('FillX: Session load error:', err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthAndProfile();

    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        if (
          changes.profile ||
          changes.userProfile ||
          changes.fillx_auth_session
        ) {
          loadAuthAndProfile();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [loadAuthAndProfile]);

  // ── Auth handlers ──────────────────────────────────────────────────────────

  /** Called after successful sign-in or sign-up */
  const handleAuthenticated = (session) => {
    setAuthSession(session);
    loadAuthAndProfile();
  };

  const handleOnboardingComplete = (newProfile) => {
    setCurrentProfile(newProfile);
    setAuthSession((prev) => ({ ...prev, isOnboarded: true }));
    setActiveTab('fill');
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthSession({ isAuthenticated: false, isOnboarded: false, user: null, token: null });
    setCurrentProfile(null);
    setActiveTab('fill');
  };

  // ── Tab navigation ─────────────────────────────────────────────────────────
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'upload') setUploadStep('prompt');
  };

  // ── Upload wizard handlers ─────────────────────────────────────────────────
  const handleStartUpload = () => setUploadStep('select');
  const handleManualEntry = () => setActiveTab('profile');

  const handleDocumentProcessed = (payload) => {
    setDocumentPayload(payload);
    setUploadStep('processing');
  };

  const handleProcessingComplete = (profile) => {
    setExtractedProfile(profile);
    setUploadStep('preview');
    loadAuthAndProfile();
  };

  const handlePreviewSave = () => {
    loadAuthAndProfile();
    setActiveTab('fill');
  };

  const handlePreviewEdit = () => {
    loadAuthAndProfile();
    setActiveTab('profile');
  };

  const navigateBack = () => {
    if (activeTab === 'upload') {
      if (uploadStep === 'select') setUploadStep('prompt');
      else if (uploadStep === 'processing') setUploadStep('select');
      else if (uploadStep === 'preview') setUploadStep('select');
      else setActiveTab('fill');
    } else {
      setActiveTab('fill');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading FillX...</div>
      </div>
    );
  }

  // 1. Unauthenticated (Sign In / Sign Up)
  if (!authSession?.isAuthenticated) {
    return (
      <div className="app-container">
        <PopupHeader title="FillX" subtitle="Sign in to continue" />
        <main className="main-content">
          <AuthScreen
            onAuthenticated={handleAuthenticated}
            onSignedUp={handleAuthenticated}
          />
        </main>
      </div>
    );
  }

  // 2. Authenticated but onboarding not complete → Profile Setup Wizard
  if (authSession.isAuthenticated && !authSession.isOnboarded) {
    return (
      <div className="app-container">
        <PopupHeader
          title="FillX Setup"
          subtitle="Profile Setup"
          user={authSession.user}
          onSignOut={handleSignOut}
        />
        <main className="main-content">
          <OnboardingScreen
            initialUser={authSession.user}
            onComplete={handleOnboardingComplete}
          />
        </main>
      </div>
    );
  }

  // 3. Fully authenticated main dashboard
  const isSubScreen =
    (activeTab === 'upload' && uploadStep !== 'prompt') || activeTab !== 'fill';

  return (
    <div className="app-container">
      <PopupHeader
        showBack={isSubScreen}
        onBack={navigateBack}
        title="FillX"
        subtitle="AI Form Autofill"
        user={authSession.user}
        onSignOut={handleSignOut}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <main className="main-content">
        {/* Tab 1: Fill Dashboard */}
        {activeTab === 'fill' && (
          <FillDashboardScreen
            profile={currentProfile}
            onNavigateToUpload={() => {
              setActiveTab('upload');
              setUploadStep('select');
            }}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        )}

        {/* Tab 2: Upload Flow */}
        {activeTab === 'upload' && (
          <>
            {uploadStep === 'prompt' && (
              <UploadPromptScreen
                onUpload={handleStartUpload}
                onManual={handleManualEntry}
              />
            )}
            {uploadStep === 'select' && (
              <DocumentSelectScreen
                onProcess={handleDocumentProcessed}
                onBack={() => setUploadStep('prompt')}
              />
            )}
            {uploadStep === 'processing' && (
              <ProcessingScreen
                documentPayload={documentPayload}
                onComplete={handleProcessingComplete}
                onError={() => setUploadStep('select')}
              />
            )}
            {uploadStep === 'preview' && (
              <DataPreviewScreen
                profile={extractedProfile || currentProfile}
                onEdit={handlePreviewEdit}
                onSave={handlePreviewSave}
              />
            )}
          </>
        )}

        {/* Tab 3: Full Profile Editor */}
        {activeTab === 'profile' && (
          <ProfileTab onProfileUpdated={loadAuthAndProfile} />
        )}

        {/* Tab 4: Activity History */}
        {activeTab === 'history' && <HistoryScreen />}

        {/* Tab 5: Settings */}
        {activeTab === 'settings' && (
          <SettingsScreen
            onProfileCleared={loadAuthAndProfile}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
