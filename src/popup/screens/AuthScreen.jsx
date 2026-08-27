import React, { useState } from 'react';
import {
  LogIn, UserPlus, Lock, Mail, User,
  AlertCircle, ScanLine, Eye, EyeOff, ChevronDown, ChevronUp, Send,
} from 'lucide-react';
import { signIn, signUp, requestPasswordReset } from '../../utils/auth.js';
import PrimaryButton from '../components/PrimaryButton.jsx';

// ── Password strength helper ──────────────────────────────────────────────────
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#10b981' };
  return { score, label: 'Strong', color: '#059669' };
}

export default function AuthScreen({ onAuthenticated, onSignedUp }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'

  // Sign-in fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPw, setSiShowPw] = useState(false);

  // Sign-up fields
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suShowPw, setSuShowPw] = useState(false);

  // Forgot password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwStrength = getPasswordStrength(suPassword);

  function switchTab(t) {
    setTab(t);
    setError('');
    setForgotOpen(false);
    setFpMsg('');
  }

  // ── Sign In ─────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn(siEmail, siPassword);
      if (res.success) {
        if (onAuthenticated) onAuthenticated(res.session);
      } else {
        setError(res.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ─────────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (suPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await signUp(suEmail, suPassword, suName);
      if (res.success) {
        if (onSignedUp) onSignedUp(res.session);
      } else {
        setError(res.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ─────────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFpLoading(true);
    setFpMsg('');
    try {
      const res = await requestPasswordReset(fpEmail);
      setFpMsg(res.message || (res.success ? 'Check your inbox for reset instructions.' : res.error));
    } catch {
      setFpMsg('Something went wrong. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="auth-container auth-scroll">

      {/* Brand badge + heading */}
      <div style={{ textAlign: 'center', marginBottom: 18, marginTop: 4 }}>
        <div className="scan-badge" style={{ width: 60, height: 60, margin: '0 auto 14px' }}>
          <ScanLine size={26} strokeWidth={1.8} />
        </div>
        <h1 className="font-display" style={{ fontSize: 22, marginBottom: 6 }}>
          {tab === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {tab === 'signin'
            ? 'Sign in to access your profile and autofill web forms instantly.'
            : 'Join FillX and eliminate repetitive form filing forever.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab-btn ${tab === 'signin' ? 'active' : ''}`}
          onClick={() => switchTab('signin')}
        >
          Sign In
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${tab === 'signup' ? 'active' : ''}`}
          onClick={() => switchTab('signup')}
        >
          Create Account
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="auth-error-banner">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Sign In Form ── */}
      {tab === 'signin' && (
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="si-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} color="var(--color-text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="si-email" type="email" required
                placeholder="alex@example.com"
                value={siEmail}
                onChange={(e) => setSiEmail(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 4 }}>
            <label htmlFor="si-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="var(--color-text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="si-password"
                type={siShowPw ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={siPassword}
                onChange={(e) => setSiPassword(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: 34, width: '100%' }}
              />
              <button type="button" onClick={() => setSiShowPw(!siShowPw)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}>
                {siShowPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <PrimaryButton type="submit" disabled={loading} icon={LogIn}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </PrimaryButton>

          {/* Forgot password toggle */}
          <button
            type="button"
            onClick={() => { setForgotOpen(!forgotOpen); setFpMsg(''); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-primary)', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4, marginTop: 2,
            }}
          >
            {forgotOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Forgot your password?
          </button>

          {forgotOpen && (
            <form
              onSubmit={handleForgotPassword}
              style={{
                padding: 12,
                background: 'var(--color-surface-inset)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                Enter your email and we'll send reset instructions.
              </p>
              <div style={{ position: 'relative' }}>
                <Mail size={13} color="var(--color-text-muted)"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email" required placeholder="alex@example.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  style={{ paddingLeft: 28, width: '100%', fontSize: 11 }}
                />
              </div>
              {fpMsg && (
                <p style={{
                  fontSize: 11, margin: 0, lineHeight: 1.5,
                  color: fpMsg.includes('sent') ? '#059669' : '#dc2626',
                }}>
                  {fpMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={fpLoading}
                style={{
                  width: '100%', height: 36, borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-primary)', color: '#fff', border: 'none',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.6px',
                  textTransform: 'uppercase', cursor: fpLoading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: fpLoading ? 0.65 : 1,
                }}
              >
                <Send size={12} />
                {fpLoading ? 'SENDING...' : 'SEND RESET LINK'}
              </button>
            </form>
          )}
        </form>
      )}

      {/* ── Sign Up Form ── */}
      {tab === 'signup' && (
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="su-name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={14} color="var(--color-text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="su-name" type="text" required
                placeholder="Alex Morgan"
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="su-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} color="var(--color-text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="su-email" type="email" required
                placeholder="alex@example.com"
                value={suEmail}
                onChange={(e) => setSuEmail(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="su-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="var(--color-text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="su-password"
                type={suShowPw ? 'text' : 'password'}
                required
                placeholder="Min. 6 characters"
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                style={{ paddingLeft: 32, paddingRight: 34, width: '100%' }}
              />
              <button type="button" onClick={() => setSuShowPw(!suShowPw)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}>
                {suShowPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Password strength bar */}
            {suPassword.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(pwStrength.score / 5) * 100}%`,
                    background: pwStrength.color,
                    transition: 'width 0.3s ease, background 0.3s ease',
                    borderRadius: 2,
                  }} />
                </div>
                <p style={{ fontSize: 10, color: pwStrength.color, marginTop: 3, fontWeight: 700 }}>
                  {pwStrength.label}
                </p>
              </div>
            )}
          </div>

          <PrimaryButton type="submit" disabled={loading} icon={UserPlus} style={{ marginTop: 6 }}>
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </PrimaryButton>
        </form>
      )}

      {/* Switch tab link */}
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          type="button"
          onClick={() => switchTab(tab === 'signin' ? 'signup' : 'signin')}
          style={{
            background: 'none', border: 'none',
            color: 'var(--color-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {tab === 'signin'
            ? "Don't have an account? Sign up →"
            : 'Already have an account? Sign in →'}
        </button>
      </div>
    </div>
  );
}
