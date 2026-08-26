/**
 * popup.js — Popup controller for Extension Core testing & verification
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statTotal = document.getElementById('stat-total');
  const statMatched = document.getElementById('stat-matched');
  const statAmbiguous = document.getElementById('stat-ambiguous');
  const statUnmatched = document.getElementById('stat-unmatched');
  const statAttention = document.getElementById('stat-attention');

  const btnAutofill = document.getElementById('btn-autofill');
  const btnScan = document.getElementById('btn-scan');
  const btnClear = document.getElementById('btn-clear');

  function updateUI(stats) {
    if (!stats) return;
    statTotal.textContent = stats.totalFields ?? 0;
    statMatched.textContent = stats.matchedCount ?? 0;
    statAmbiguous.textContent = stats.ambiguousCount ?? 0;
    statUnmatched.textContent = stats.unmatchedCount ?? 0;
    statAttention.textContent = stats.fieldsNeedAttention ?? 0;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Fetch initial status on popup open
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_GET_PAGE_STATUS' });
      if (response?.stats) {
        updateUI(response.stats);
      }
    }
  } catch (err) {
    // If content script is not yet injected or on chrome:// page
  }

  // Scan button
  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_SCAN_PAGE' });
        if (response?.stats) {
          updateUI(response.stats);
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      btnScan.disabled = false;
    }
  });

  // Autofill button
  btnAutofill.addEventListener('click', async () => {
    btnAutofill.disabled = true;
    btnAutofill.textContent = '⏳ Matching & Filling...';
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILLX_AUTOFILL_PAGE',
      });
      if (response?.fillOutcome?.stats) {
        updateUI(response.fillOutcome.stats);
      }
    } catch (err) {
      console.error('Autofill error:', err);
    } finally {
      btnAutofill.disabled = false;
      btnAutofill.textContent = '⚡ Fill This Page';
    }
  });

  // Clear Highlights button
  btnClear.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_CLEAR_HIGHLIGHTS' });
        if (response?.stats) {
          updateUI(response.stats);
        }
      }
    } catch (err) {
      console.error('Clear error:', err);
    }
  });
});
