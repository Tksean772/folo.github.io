// ─── Firestore imports ────────────────────────────────────────────────────────
import { db } from './firebase-config.js';
import {
  collection, doc, getDocs, addDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Session guard ────────────────────────────────────────────────────────────
const session = JSON.parse(localStorage.getItem('folo_session') || 'null');
if (!session || !session.token) window.location.replace('login.html');

window.addEventListener('pageshow', () => {
  const s = JSON.parse(localStorage.getItem('folo_session') || 'null');
  if (!s || !s.token) window.location.replace('login.html');
});

// ─── State ────────────────────────────────────────────────────────────────────
let budgets = [];
let transactions = [];
const BUDGET_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Savings', 'Other'];

const budgetsRef      = () => collection(db, 'users', session.user.id, 'budgets');
const transactionsRef = () => collection(db, 'users', session.user.id, 'transactions');

// ─── Load ─────────────────────────────────────────────────────────────────────
async function loadBudgets() {
  try {
    const [budgetSnap, txnSnap] = await Promise.all([
      getDocs(budgetsRef()),
      getDocs(query(transactionsRef(), orderBy('transaction_date', 'desc')))
    ]);

    budgets      = budgetSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    transactions = txnSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    populateCategoryOptions();
    renderBudgets();
    renderSummary();
    updateSidebar();
  } catch (err) {
    console.error('Failed to load budgets:', err);
    alert('Could not load budgets. Check your internet connection.');
  }
}

// ─── Save budget ──────────────────────────────────────────────────────────────
window.saveBudget = async function() {
  const cat   = document.getElementById('fCat').value;
  const limit = parseFloat(document.getElementById('fLimit').value);

  if (!cat || !limit || limit <= 0) { alert('Please enter a category and a valid limit.'); return; }

  // Prevent duplicate categories
  if (budgets.find(b => b.category === cat)) {
    alert(`A budget for "${cat}" already exists. Delete it first or edit the limit.`);
    return;
  }

  try {
    await addDoc(budgetsRef(), {
      category:     cat,
      amount_limit: limit,
      period:       'monthly',
      createdAt:    new Date().toISOString()
    });
    closeModal();
    document.getElementById('fLimit').value = '';
    await loadBudgets();
  } catch (err) {
    console.error('Save budget failed:', err);
    alert('Failed to save budget. Please try again.');
  }
};

// ─── Render ───────────────────────────────────────────────────────────────────
function renderBudgets() {
  const container = document.getElementById('budgetsGrid');
  container.innerHTML = '';

  if (budgets.length === 0) {
    container.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">No budgets yet. Create one above!</div>';
    return;
  }

  const now = new Date();
  budgets.forEach(b => {
    const spent = transactions
      .filter(t => {
        if (t.category !== b.category || t.type !== 'expense') return false;
        const d = new Date(t.transaction_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const limit = Number(b.amount_limit) || 0;
    const perc  = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    const over  = spent > limit;

    const card = document.createElement('div');
    card.className = 'budget-card';
    card.innerHTML = `
      <div class="budget-header">
        <div class="budget-cat">${b.category}</div>
        <div class="budget-amt" style="color:${over ? 'var(--danger,#c94040)' : 'inherit'}">
          ${fmt(spent)} / ${fmt(limit)}
        </div>
      </div>
      <div class="progress-bg">
        <div class="progress-fill" style="width:${perc}%;background:${over ? 'var(--danger,#c94040)' : 'var(--accent)'}"></div>
      </div>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:0.4rem">${perc.toFixed(0)}% used${over ? ' — over budget!' : ''}</div>
    `;
    container.appendChild(card);
  });
}

function renderSummary() {
  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.amount_limit || 0), 0);
  const now = new Date();
  const totalSpent = transactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.transaction_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  document.getElementById('budgetMonth').textContent =
    now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('summaryStrip').innerHTML = `
    <div class="summary-pill">${budgets.length} budget${budgets.length !== 1 ? 's' : ''}</div>
    <div class="summary-pill">Planned: ${fmt(totalLimit)}</div>
    <div class="summary-pill">Spent: ${fmt(totalSpent)}</div>
  `;
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: session.user.currency || 'USD'
  }).format(Number(amount) || 0);
}

function populateCategoryOptions() {
  const select = document.getElementById('fCat');
  if (!select) return;
  select.innerHTML = BUDGET_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

function updateSidebar() {
  document.getElementById('sidebarName').textContent = session.user.name || 'You';
  document.getElementById('sidebarAvatar').textContent = (session.user.name || 'Y').charAt(0).toUpperCase();
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
window.openModal    = () => document.getElementById('modalBackdrop').classList.add('open');
window.closeModal   = () => document.getElementById('modalBackdrop').classList.remove('open');
window.maybeClose   = e  => { if (e.target.id === 'modalBackdrop') window.closeModal(); };
window.openSidebar  = () => { document.getElementById('sidebar').classList.add('open');  document.getElementById('overlay').classList.add('open'); };
window.closeSidebar = () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); };
window.logout       = () => { localStorage.removeItem('folo_session'); sessionStorage.clear(); window.location.replace('login.html'); };

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadBudgets();
