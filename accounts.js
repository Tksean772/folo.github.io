// ─── Firestore imports ───────────────────────────────────────────────────────
import { db } from './firebase-config.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Session guard ────────────────────────────────────────────────────────────
const session = JSON.parse(localStorage.getItem('folo_session') || 'null');
if (!session || !session.token) window.location.replace('login.html');

window.addEventListener('pageshow', () => {
  const s = JSON.parse(localStorage.getItem('folo_session') || 'null');
  if (!s || !s.token) window.location.replace('login.html');
});

// ─── State ────────────────────────────────────────────────────────────────────
let accounts = [];
let selectedColor = '#588973';
const ACCOUNT_COLORS = ['#588973', '#3a5a8c', '#b86b5f', '#c59b5f', '#7b4f9e', '#4f8c7a'];

// Helper: Firestore path for this user's accounts
const accountsRef = () => collection(db, 'users', session.user.id, 'accounts');

// ─── Load ─────────────────────────────────────────────────────────────────────
async function loadAccounts() {
  try {
    const snap = await getDocs(query(accountsRef(), orderBy('name')));
    accounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAccounts();
    renderNetWorth();
    populateAdjustAccounts();
    initSettings();
    initColorPicker();
    updateSidebar();
  } catch (err) {
    console.error('Failed to load accounts:', err);
    alert('Could not load accounts. Check your internet connection.');
  }
}

// ─── Save new account ─────────────────────────────────────────────────────────
window.saveAccount = async function() {
  const name = document.getElementById('fName').value.trim();
  const type = document.getElementById('fType').value;
  const balance = parseFloat(document.getElementById('fBalance').value) || 0;

  if (!name) { alert('Account name is required.'); return; }

  try {
    await addDoc(accountsRef(), {
      name,
      type,
      balance,
      color: selectedColor,
      createdAt: new Date().toISOString()
    });
    closeModal();
    document.getElementById('fName').value = '';
    document.getElementById('fBalance').value = '';
    await loadAccounts();
  } catch (err) {
    console.error('Save account failed:', err);
    alert('Failed to save account. Please try again.');
  }
};

// ─── Adjust balance ───────────────────────────────────────────────────────────
window.applyAdjust = async function() {
  const accountId = document.getElementById('adjAcc').value;
  const balance = parseFloat(document.getElementById('adjBalance').value);

  if (!accountId || Number.isNaN(balance)) {
    alert('Select an account and enter a balance.');
    return;
  }

  try {
    await updateDoc(doc(db, 'users', session.user.id, 'accounts', accountId), { balance });
    document.getElementById('adjBalance').value = '';
    closeAdjustModal();
    await loadAccounts();
  } catch (err) {
    console.error('Adjust balance failed:', err);
    alert('Failed to adjust balance. Please try again.');
  }
};

// ─── Save settings ────────────────────────────────────────────────────────────
window.saveSettings = async function() {
  const name = document.getElementById('settingName').value.trim();
  const currency = document.getElementById('settingCurrency').value;

  if (!name) { alert('Name is required.'); return; }

  // Update Firestore profile
  try {
    const [firstName, ...rest] = name.split(' ');
    await updateDoc(doc(db, 'users', session.user.id), {
      firstName,
      lastName: rest.join(' '),
      currency
    });
  } catch (err) {
    console.error('Could not sync settings to Firestore:', err);
    // Still save locally so the UI updates
  }

  session.user.name = name;
  session.user.currency = currency;
  localStorage.setItem('folo_session', JSON.stringify(session));
  updateSidebar();
  renderAccounts();
  renderNetWorth();
  alert('Settings saved.');
};

// ─── Delete account ───────────────────────────────────────────────────────────
window.deleteUserAccount = async function() {
  const confirmed = confirm('This will permanently delete ALL your data. Are you sure?');
  if (!confirmed) return;
  alert('To fully delete your account please contact folo.tracker@gmail.com from your registered email address. We will process it within 24 hours.');
};

// ─── Reset data ───────────────────────────────────────────────────────────────
window.resetData = async function() {
  const confirmed = confirm('Reset ALL data? This will delete all your accounts and transactions. This cannot be undone.');
  if (!confirmed) return;
  try {
    const snap = await getDocs(accountsRef());
    const deletes = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
    await loadAccounts();
    alert('All account data has been reset.');
  } catch (err) {
    console.error('Reset failed:', err);
    alert('Reset failed. Please try again.');
  }
};

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAccounts() {
  const container = document.getElementById('accountsGrid');
  container.innerHTML = '';

  if (accounts.length === 0) {
    container.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">No accounts yet. Add one above!</div>';
    return;
  }

  accounts.forEach(acc => {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-card-header">
        <div class="account-dot" style="background:${acc.color || '#ccc'}"></div>
        <div class="account-name">${acc.name}</div>
      </div>
      <div class="account-balance">${fmt(acc.balance)}</div>
      <div class="account-type">${acc.type}</div>
    `;
    container.appendChild(card);
  });
}

function renderNetWorth() {
  const total = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  document.getElementById('nwBar').innerHTML = `
    <div class="summary-pill">Accounts: ${accounts.length}</div>
    <div class="summary-pill">Net worth: <strong>${fmt(total)}</strong></div>
  `;
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: session.user.currency || 'USD'
  }).format(Number(amount) || 0);
}

function initColorPicker() {
  const row = document.getElementById('colorRow');
  if (!row || row.dataset.ready === 'true') return;

  row.innerHTML = ACCOUNT_COLORS.map(color => `
    <button type="button" class="color-dot${color === selectedColor ? ' active' : ''}"
      data-color="${color}" style="background:${color};width:28px;height:28px;border-radius:999px;border:2px solid rgba(0,0,0,0.08)">
    </button>
  `).join('');

  row.addEventListener('click', e => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    selectedColor = btn.dataset.color;
    row.querySelectorAll('[data-color]').forEach(el =>
      el.classList.toggle('active', el.dataset.color === selectedColor)
    );
  });

  row.dataset.ready = 'true';
}

function populateAdjustAccounts() {
  const select = document.getElementById('adjAcc');
  if (!select) return;
  select.innerHTML = accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
}

function initSettings() {
  document.getElementById('settingName').value = session.user.name || '';
  document.getElementById('settingCurrency').value = session.user.currency || 'USD';
}

function updateSidebar() {
  document.getElementById('sidebarName').textContent = session.user.name || 'You';
  document.getElementById('sidebarAvatar').textContent = (session.user.name || 'Y').charAt(0).toUpperCase();
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
window.openModal        = () => document.getElementById('modalBackdrop').classList.add('open');
window.closeModal       = () => document.getElementById('modalBackdrop').classList.remove('open');
window.maybeClose       = e  => { if (e.target.id === 'modalBackdrop') window.closeModal(); };
window.openAdjustModal  = () => document.getElementById('adjustBackdrop').classList.add('open');
window.closeAdjustModal = () => document.getElementById('adjustBackdrop').classList.remove('open');
window.maybeCloseAdj    = e  => { if (e.target.id === 'adjustBackdrop') window.closeAdjustModal(); };
window.openSidebar      = () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('open'); };
window.closeSidebar     = () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); };
window.logout           = () => { localStorage.removeItem('folo_session'); sessionStorage.clear(); window.location.replace('login.html'); };

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadAccounts();
