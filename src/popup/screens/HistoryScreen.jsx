/**
 * HistoryScreen.jsx — Autofill History Log
 * Shows every form fill: site, time, field counts.
 * Click any entry → expandable detail panel.
 * Export to CSV, clear history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, XCircle, Globe, Trash2, Download, RefreshCw } from 'lucide-react';
import { getHistory, clearHistory } from '../../utils/storage.js';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDomain(url) {
  if (!url) return 'Unknown Site';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url.slice(0, 40); }
}

function FillBar({ matched, ambiguous, unmatched }) {
  const total = matched + ambiguous + unmatched;
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
      {matched > 0 && <div style={{ flex: matched, background: '#10b981' }} />}
      {ambiguous > 0 && <div style={{ flex: ambiguous, background: '#f59e0b' }} />}
      {unmatched > 0 && <div style={{ flex: unmatched, background: '#ef4444' }} />}
    </div>
  );
}

function StatusDot({ count, color, label }) {
  if (!count) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {count} {label}
    </span>
  );
}

function FieldDetail({ field }) {
  const statusColor = field.status === 'matched' ? '#10b981' : field.status === 'ambiguous' ? '#f59e0b' : '#ef4444';
  const StatusIcon = field.status === 'matched' ? CheckCircle2 : field.status === 'ambiguous' ? AlertCircle : XCircle;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <StatusIcon size={12} color={statusColor} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {field.label || field.name || field.id || 'Unknown field'}
        </div>
        {field.value && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            → {String(field.value).slice(0, 60)}{String(field.value).length > 60 ? '…' : ''}
          </div>
        )}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
        {field.status === 'no_match' ? 'missed' : field.status}
      </div>
    </div>
  );
}

function HistoryEntry({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const stats = item.stats || {};
  const matched = stats.matchedCount || 0;
  const ambiguous = stats.ambiguousCount || 0;
  const unmatched = stats.unmatchedCount || 0;
  const total = stats.totalFields || (matched + ambiguous + unmatched);
  const fields = item.fields || [];
  const domain = getDomain(item.url);
  const fillRate = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      borderColor: expanded ? 'var(--color-primary)' : 'var(--color-border)',
    }}>
      {/* Main clickable row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}
      >
        {/* Site favicon placeholder */}
        <div style={{
          width: 34, height: 34, borderRadius: 8, background: 'var(--color-secondary-pale)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Globe size={16} color="var(--color-primary)" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Domain + time */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {domain}
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {timeAgo(item.timestamp)}
            </span>
          </div>

          {/* Field count summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {total} field{total !== 1 ? 's' : ''}
            </span>
            <StatusDot count={matched} color="#10b981" label="filled" />
            {ambiguous > 0 && <StatusDot count={ambiguous} color="#f59e0b" label="review" />}
            {unmatched > 0 && <StatusDot count={unmatched} color="#ef4444" label="missed" />}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 5 }}>
            <FillBar matched={matched} ambiguous={ambiguous} unmatched={unmatched} />
          </div>
        </div>

        {/* Fill rate badge + chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: fillRate >= 80 ? '#10b981' : fillRate >= 50 ? '#f59e0b' : '#ef4444',
            background: fillRate >= 80 ? '#ecfdf5' : fillRate >= 50 ? '#fffbeb' : '#fef2f2',
            padding: '2px 7px', borderRadius: 20,
          }}>
            {fillRate}%
          </span>
          {expanded ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px' }}>
          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Timestamp</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatTimestamp(item.timestamp)}</div>
            </div>
            {item.profileName && (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Profile Used</div>
                <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>{item.profileName}</div>
              </div>
            )}
          </div>

          {/* Full URL */}
          {item.url && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 3 }}>Page URL</div>
              <a href={item.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: 'var(--color-primary)', wordBreak: 'break-all', textDecoration: 'none' }}>
                {item.url.slice(0, 80)}{item.url.length > 80 ? '…' : ''}
              </a>
            </div>
          )}

          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
            <MiniStatCard value={matched} label="Filled" color="#10b981" bg="#ecfdf5" />
            <MiniStatCard value={ambiguous} label="Review" color="#f59e0b" bg="#fffbeb" />
            <MiniStatCard value={unmatched} label="Missed" color="#ef4444" bg="#fef2f2" />
          </div>

          {/* Field details */}
          {fields.length > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Field Details
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {fields.map((f, i) => <FieldDetail key={i} field={f} />)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
              No field detail available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStatCard({ value, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
    </div>
  );
}

export default function HistoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const history = await getHistory();
    setItems(Array.isArray(history) ? history : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClear() {
    if (!confirm('Clear all autofill history? This cannot be undone.')) return;
    await clearHistory();
    setItems([]);
  }

  function handleExport() {
    if (items.length === 0) return;
    const rows = [
      ['Timestamp', 'Site', 'URL', 'Total Fields', 'Matched', 'Ambiguous', 'Unmatched', 'Fill Rate %', 'Profile Used'],
      ...items.map(item => {
        const s = item.stats || {};
        const total = s.totalFields || 0;
        const matched = s.matchedCount || 0;
        const rate = total > 0 ? Math.round((matched / total) * 100) : 0;
        return [
          item.timestamp ? new Date(item.timestamp).toLocaleString() : '',
          getDomain(item.url),
          item.url || '',
          total, matched, s.ambiguousCount || 0, s.unmatchedCount || 0, rate,
          item.profileName || '',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fillx-history-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>YOUR ACTIVITY</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginTop: 2 }}>Fill History</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {items.length} session{items.length !== 1 ? 's' : ''} · Click any entry for details
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {items.length > 0 && (
            <>
              <button onClick={handleExport} title="Export CSV"
                style={{ background: 'var(--color-surface-inset)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Download size={13} color="var(--color-text-muted)" />
              </button>
              <button onClick={handleClear} title="Clear history"
                style={{ background: 'var(--color-surface-inset)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={13} color="#dc2626" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '6px 10px', background: 'var(--color-surface-inset)', borderRadius: 8 }}>
          {[['#10b981', 'Filled'], ['#f59e0b', 'Review'], ['#ef4444', 'Missed']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
            </div>
          ))}
        </div>
      )}

      {/* History list */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-muted)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-secondary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Globe size={24} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>No fill history yet</div>
          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
            Every time you fill a form, it'll appear here with the site, timestamp, and field-by-field breakdown.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => <HistoryEntry key={item.id || i} item={item} index={i} />)}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
