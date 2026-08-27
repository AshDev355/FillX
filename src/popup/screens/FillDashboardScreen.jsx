import React, { useState, useEffect } from 'react';
import { Zap, Search, Trash2, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';
import { MESSAGE_TYPES } from '../../shared/messageTypes.js';

export default function FillDashboardScreen({ onNavigateToUpload, onNavigateToProfile, profile }) {
  const [stats, setStats] = useState({
    totalFields: 0,
    matchedCount: 0,
    ambiguousCount: 0,
    unmatchedCount: 0,
    fieldsNeedAttention: 0,
  });
  const [isFilling, setIsFilling] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    fetchPageStatus();
  }, []);

  async function getActiveTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function isScriptableUrl(url) {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://');
  }

  async function fetchPageStatus() {
    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isScriptableUrl(tab.url)) return;

      chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_PAGE_STATUS }, (response) => {
        if (chrome.runtime?.lastError) return;
        if (response?.stats) {
          setStats(response.stats);
        }
      });
    } catch (err) {}
  }

  async function handleScan() {
    setIsScanning(true);
    setStatusMessage(null);
    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isScriptableUrl(tab.url)) {
        setStatusMessage({ type: 'info', text: 'Open a webpage or form tab to scan.' });
        setIsScanning(false);
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.SCAN_PAGE }, (response) => {
        if (chrome.runtime?.lastError) {
          setStatusMessage({ type: 'info', text: 'Refresh the page to activate autofill scanner.' });
          setIsScanning(false);
          return;
        }

        if (response?.stats) {
          setStats(response.stats);
          setStatusMessage({ type: 'success', text: `Found ${response.stats.totalFields} form fields` });
        } else {
          setStatusMessage({ type: 'info', text: 'No fillable form fields detected.' });
        }
        setIsScanning(false);
      });
    } catch (err) {
      setIsScanning(false);
      setStatusMessage({ type: 'error', text: 'Unable to scan page.' });
    }
  }

  async function handleAutofill() {
    setIsFilling(true);
    setStatusMessage(null);

    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isScriptableUrl(tab.url)) {
        setStatusMessage({ type: 'info', text: 'Open a website or form tab first.' });
        setIsFilling(false);
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: MESSAGE_TYPES.AUTOFILL_PAGE,
            payload: { profile },
          },
          (response) => {
            setIsFilling(false);
            if (response?.fillOutcome?.stats) {
              setStats(response.fillOutcome.stats);
            }
            if (response?.success) {
              const filled = response.fillOutcome?.filledCount || 0;
              setStatusMessage({
                type: 'success',
                text: `Successfully filled ${filled} ${filled === 1 ? 'field' : 'fields'}!`,
              });
            } else {
              setStatusMessage({
                type: 'error',
                text: response?.error || 'Autofill could not be completed.',
              });
            }
          }
        );
      } else {
        setTimeout(() => {
          setIsFilling(false);
          setStatusMessage({ type: 'success', text: 'Autofill simulation completed.' });
        }, 600);
      }
    } catch (err) {
      setIsFilling(false);
      setStatusMessage({ type: 'error', text: 'Autofill request failed.' });
    }
  }

  async function handleClear() {
    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isScriptableUrl(tab.url)) return;

      chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.CLEAR_HIGHLIGHTS }, (response) => {
        if (response?.stats) {
          setStats(response.stats);
        }
        setStatusMessage({ type: 'info', text: 'All field highlights cleared.' });
      });
    } catch (err) {}
  }

  const hasProfile = profile?.personal?.firstName || profile?.personal?.fullName || profile?.personal?.email;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 14px' }}>
      {/* Profile Header Status Banner */}
      {!hasProfile ? (
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--color-surface-inset)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>No Profile Loaded</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>Upload a document to enable autofill</div>
          </div>
          <button
            onClick={onNavigateToUpload}
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>Upload</span>
            <ArrowRight size={12} />
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--color-secondary-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <FileText size={14} />
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Active Profile: <strong style={{ color: 'var(--color-text-primary)' }}>{profile.personal?.fullName || profile.personal?.firstName || 'Active'}</strong>
            </span>
          </div>
          <button
            onClick={onNavigateToProfile}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      )}

      {/* Field Detection Metrics Card */}
      <div className="card-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Detected Fields on Page
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-primary)',
              background: 'var(--color-secondary-pale)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {stats.totalFields}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div
            style={{
              background: 'var(--color-surface-inset)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Matched</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 2 }}>
              {stats.matchedCount}
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-surface-inset)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700, textTransform: 'uppercase' }}>Review</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 2 }}>
              {stats.ambiguousCount}
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-surface-inset)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Unmatched</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
              {stats.unmatchedCount}
            </div>
          </div>
        </div>

        {stats.fieldsNeedAttention > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#92400e',
            }}
          >
            <AlertTriangle size={14} color="#d97706" flexShrink={0} />
            <span>
              <strong>{stats.fieldsNeedAttention}</strong> {stats.fieldsNeedAttention === 1 ? 'field needs' : 'fields need'} review or input
            </span>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            background: statusMessage.type === 'success' ? '#ecfdf5' : statusMessage.type === 'error' ? '#fef2f2' : '#f5f3ff',
            border: `1px solid ${statusMessage.type === 'success' ? '#a7f3d0' : statusMessage.type === 'error' ? '#fecaca' : '#ddd6fe'}`,
            color: statusMessage.type === 'success' ? '#065f46' : statusMessage.type === 'error' ? '#991b1b' : '#5b21b6',
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Action Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <PrimaryButton
          icon={Zap}
          onClick={handleAutofill}
          disabled={isFilling}
        >
          {isFilling ? '⚡ MATCHING & FILLING...' : '⚡ FILL THIS PAGE'}
        </PrimaryButton>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <OutlineButton
            icon={Search}
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? 'SCANNING...' : 'SCAN FIELDS'}
          </OutlineButton>

          <OutlineButton
            icon={Trash2}
            onClick={handleClear}
          >
            CLEAR HIGHLIGHTS
          </OutlineButton>
        </div>
      </div>
    </div>
  );
}
