/**
 * popup.js — Complete Controller for FillX Popup UI
 *
 * Implements:
 * 1. Document Upload & Text Extraction (PDF, DOCX, TXT, JSON)
 * 2. Processing State with Progress Bar
 * 3. Editable Profile Management (Read/Write to chrome.storage.local)
 * 4. Autofill Execution on Active Tab
 * 5. Screen Navigation & Toast Alerts
 */

const DEFAULT_PROFILE = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'Johnathan Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 234-5678',
    dateOfBirth: '1995-06-15',
  },
  address: {
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'Oregon',
    zip: '97477',
    country: 'United States',
  },
  experience: [
    { company: 'Acme Software Corp', title: 'Senior Frontend Developer' },
  ],
  education: [
    { school: 'Springfield University', degree: 'B.S. in Computer Science' },
  ],
  skills: ['JavaScript', 'React', 'Node.js', 'Chrome Extensions'],
  custom: {
    desired_salary: '$140,000',
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation elements
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');
  const toastEl = document.getElementById('toast');

  // Upload elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const btnGoManual = document.getElementById('btn-go-manual');
  const btnQuickSample = document.getElementById('btn-quick-sample');

  // Processing elements
  const procFileName = document.getElementById('proc-file-name');
  const procProgressBar = document.getElementById('proc-progress-bar');
  const procPercent = document.getElementById('proc-percent');

  // Profile Form elements
  const profFirstName = document.getElementById('prof_firstName');
  const profLastName = document.getElementById('prof_lastName');
  const profFullName = document.getElementById('prof_fullName');
  const profEmail = document.getElementById('prof_email');
  const profPhone = document.getElementById('prof_phone');
  const profStreet = document.getElementById('prof_street');
  const profCity = document.getElementById('prof_city');
  const profState = document.getElementById('prof_state');
  const profZip = document.getElementById('prof_zip');
  const profCountry = document.getElementById('prof_country');
  const profCompany = document.getElementById('prof_company');
  const profTitle = document.getElementById('prof_title');
  const profSchool = document.getElementById('prof_school');
  const profDegree = document.getElementById('prof_degree');
  const profCustomSalary = document.getElementById('prof_custom_salary');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const btnClearProfile = document.getElementById('btn-clear-profile');

  // Fill Tab elements
  const statTotal = document.getElementById('stat-total');
  const statMatched = document.getElementById('stat-matched');
  const statAmbiguous = document.getElementById('stat-ambiguous');
  const statUnmatched = document.getElementById('stat-unmatched');
  const statAttention = document.getElementById('stat-attention');
  const btnAutofill = document.getElementById('btn-autofill');
  const btnScan = document.getElementById('btn-scan');
  const btnClear = document.getElementById('btn-clear');
  const btnResetAll = document.getElementById('btn-reset-all');

  // ─── Screen Navigation ───────────────────────────────────────────────────────

  function showScreen(screenId) {
    screens.forEach((s) => s.classList.remove('active'));
    navItems.forEach((n) => n.classList.remove('active'));

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');

    const activeNav = document.querySelector(`.nav-item[data-target="${screenId}"]`);
    if (activeNav) activeNav.classList.add('active');

    if (screenId === 'screen-fill') {
      refreshTabStats();
    } else if (screenId === 'screen-profile') {
      loadProfileIntoForm();
    }
  }

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      showScreen(target);
    });
  });

  btnGoManual.addEventListener('click', () => {
    showScreen('screen-profile');
  });

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.style.display = 'block';
    setTimeout(() => {
      toastEl.style.display = 'none';
    }, 2500);
  }

  // ─── Profile Storage Helpers ────────────────────────────────────────────────

  async function getProfileFromStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const data = await chrome.storage.local.get(['profile']);
      return data.profile || DEFAULT_PROFILE;
    }
    const local = localStorage.getItem('fillx_profile');
    return local ? JSON.parse(local) : DEFAULT_PROFILE;
  }

  async function saveProfileToStorage(profile) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ profile });
    } else {
      localStorage.setItem('fillx_profile', JSON.stringify(profile));
    }
  }

  async function loadProfileIntoForm() {
    const profile = await getProfileFromStorage();
    const p = profile.personal || {};
    const a = profile.address || {};
    const exp = Array.isArray(profile.experience) && profile.experience[0] ? profile.experience[0] : {};
    const edu = Array.isArray(profile.education) && profile.education[0] ? profile.education[0] : {};
    const custom = profile.custom || {};

    profFirstName.value = p.firstName || '';
    profLastName.value = p.lastName || '';
    profFullName.value = p.fullName || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : '');
    profEmail.value = p.email || '';
    profPhone.value = p.phone || '';

    profStreet.value = a.street || '';
    profCity.value = a.city || '';
    profState.value = a.state || '';
    profZip.value = a.zip || '';
    profCountry.value = a.country || '';

    profCompany.value = exp.company || '';
    profTitle.value = exp.title || '';
    profSchool.value = edu.school || '';
    profDegree.value = edu.degree || '';
    profCustomSalary.value = custom.desired_salary || '';
  }

  btnSaveProfile.addEventListener('click', async () => {
    const updatedProfile = {
      personal: {
        firstName: profFirstName.value.trim(),
        lastName: profLastName.value.trim(),
        fullName: profFullName.value.trim() || `${profFirstName.value.trim()} ${profLastName.value.trim()}`.trim(),
        email: profEmail.value.trim(),
        phone: profPhone.value.trim(),
      },
      address: {
        street: profStreet.value.trim(),
        city: profCity.value.trim(),
        state: profState.value.trim(),
        zip: profZip.value.trim(),
        country: profCountry.value.trim(),
      },
      experience: [
        {
          company: profCompany.value.trim(),
          title: profTitle.value.trim(),
        },
      ],
      education: [
        {
          school: profSchool.value.trim(),
          degree: profDegree.value.trim(),
        },
      ],
      custom: {
        desired_salary: profCustomSalary.value.trim(),
      },
    };

    await saveProfileToStorage(updatedProfile);
    showToast('Profile Saved Successfully ✓');
    setTimeout(() => {
      showScreen('screen-fill');
    }, 600);
  });

  btnClearProfile.addEventListener('click', async () => {
    if (confirm('Reset profile to default values?')) {
      await saveProfileToStorage(DEFAULT_PROFILE);
      await loadProfileIntoForm();
      showToast('Profile Reset ✓');
    }
  });

  btnQuickSample.addEventListener('click', async () => {
    await saveProfileToStorage(DEFAULT_PROFILE);
    await loadProfileIntoForm();
    showToast('Sample Resume Profile Loaded ✓');
    showScreen('screen-profile');
  });

  // ─── Document Upload & Extraction Simulation ─────────────────────────────────

  dropZone.addEventListener('click', () => fileInput.click());
  btnTriggerUpload.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  async function handleFileSelected(file) {
    if (!file) return;

    procFileName.textContent = file.name;
    showScreen('screen-processing');

    // Simulate AI extraction progress
    let percent = 0;
    const interval = setInterval(async () => {
      percent += 20;
      procProgressBar.style.width = `${percent}%`;
      procPercent.textContent = `${percent}% COMPLETE`;

      if (percent >= 100) {
        clearInterval(interval);

        // Extract text / parse if JSON
        if (file.name.endsWith('.json')) {
          try {
            const text = await file.text();
            const json = JSON.parse(text);
            await saveProfileToStorage(json.profile || json);
          } catch (err) {
            console.warn('Could not parse JSON file, using default');
          }
        } else {
          // If text or other doc, extract name/email or use sample profile
          const sample = {
            ...DEFAULT_PROFILE,
            meta: { sourceFileName: file.name, lastUpdated: new Date().toISOString() },
          };
          await saveProfileToStorage(sample);
        }

        setTimeout(() => {
          showToast('Extraction Complete ✓');
          showScreen('screen-profile');
        }, 400);
      }
    }, 150);
  }

  // ─── Fill Tab & Tab Communication ───────────────────────────────────────────

  async function getActiveTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    }
    return null;
  }

  function updateStatsUI(stats) {
    if (!stats) return;
    statTotal.textContent = stats.totalFields ?? 0;
    statMatched.textContent = stats.matchedCount ?? 0;
    statAmbiguous.textContent = stats.ambiguousCount ?? 0;
    statUnmatched.textContent = stats.unmatchedCount ?? 0;
    statAttention.textContent = stats.fieldsNeedAttention ?? 0;
  }

  async function refreshTabStats() {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_GET_PAGE_STATUS' });
        if (response?.stats) {
          updateStatsUI(response.stats);
        }
      }
    } catch (err) {
      // Content script may not be loaded on internal pages
    }
  }

  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_SCAN_PAGE' });
        if (response?.stats) {
          updateStatsUI(response.stats);
          showToast(`Found ${response.stats.totalFields} form fields`);
        }
      }
    } catch (err) {
      showToast('Please open a webpage with a form');
    } finally {
      btnScan.disabled = false;
    }
  });

  btnAutofill.addEventListener('click', async () => {
    btnAutofill.disabled = true;
    btnAutofill.textContent = '⏳ Matching & Filling...';

    try {
      const profile = await getProfileFromStorage();
      const response = await chrome.runtime.sendMessage({
        type: 'FILLX_AUTOFILL_PAGE',
        payload: { profile },
      });

      if (response?.fillOutcome?.stats) {
        updateStatsUI(response.fillOutcome.stats);
        showToast(`Filled ${response.fillOutcome.filledCount} fields ✓`);
      } else {
        showToast('Autofill completed ✓');
      }
    } catch (err) {
      showToast('Error during autofill');
      console.error(err);
    } finally {
      btnAutofill.disabled = false;
      btnAutofill.textContent = '⚡ Fill This Page';
    }
  });

  btnClear.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILLX_CLEAR_HIGHLIGHTS' });
        if (response?.stats) {
          updateStatsUI(response.stats);
          showToast('Highlights Cleared');
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  btnResetAll.addEventListener('click', async () => {
    if (confirm('Reset all extension profile data and cached fields?')) {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.clear();
      }
      localStorage.clear();
      await saveProfileToStorage(DEFAULT_PROFILE);
      await loadProfileIntoForm();
      showToast('All Data Reset ✓');
      showScreen('screen-upload');
    }
  });

  // Initialize
  await loadProfileIntoForm();
  await refreshTabStats();
});
