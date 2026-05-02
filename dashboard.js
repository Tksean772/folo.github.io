// ─── Firestore imports ────────────────────────────────────────────────────────
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ─── Session guard ────────────────────────────────────────────────────────────
const session = JSON.parse(localStorage.getItem('folo_session') || 'null');
if (!session || !session.token) window.location.replace('login.html');

window.addEventListener('pageshow', () => {
  const s = JSON.parse(localStorage.getItem('folo_session') || 'null');
  if (!s || !s.token) window.location.replace('login.html');
});

// ─── State ────────────────────────────────────────────────────────────────────
let appData = { accounts: [], transactions: [], budgets: [] };

// ─── Load all data ────────────────────────────────────────────────────────────
async function fetchAllData() {
  try {
    const uid = session.user.id;
    const [accSnap, txnSnap, budgetSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'accounts')),
      getDocs(query(collection(db, 'users', uid, 'transactions'), orderBy('transaction_date', 'desc'))),
      getDocs(collection(db, 'users', uid, 'budgets'))
    ]);

    appData.accounts     = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    appData.transactions = txnSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    appData.budgets      = budgetSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderDashboard();
    updateSidebar();
  } catch (err) {
    console.error('Dashboard load failed:', err);
    document.querySelector('.page-content').innerHTML =
      '<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">Could not load dashboard data. Please refresh the page.</div>';
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderDashboard() {
  const currency  = session.user.currency || 'USD';
  const netWorth  = appData.accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  const now       = new Date();

  const currentMonthTxns = appData.transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income   = currentMonthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const expenses = currentMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;

  document.getElementById('statNetWorth').textContent  = fmt(netWorth, currency);
  document.getElementById('statIncome').textContent    = fmt(income, currency);
  document.getElementById('statExpenses').textContent  = fmt(expenses, currency);
  document.getElementById('statSavings').textContent   = savingsRate + '%';

  const incomeSub   = document.getElementById('statIncomeSub');
  const expensesSub = document.getElementById('statExpensesSub');
  if (incomeSub)   incomeSub.textContent   = now.toLocaleDateString('en-US', { month: 'long' });
  if (expensesSub) expensesSub.textContent = now.toLocaleDateString('en-US', { month: 'long' });

  renderCategoryChart(currentMonthTxns, currency);
  renderAccounts(currency);
  renderRecentTransactions(currency);
}

function fmt(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || session.user.currency || 'USD'
  }).format(Number(amount) || 0);
}

function renderCategoryChart(txns, currency) {
  const chart     = document.getElementById('categoryChart');
  const spendMonth = document.getElementById('spendMonth');
  spendMonth.textContent = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const totals = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'Other';
    totals[cat] = (totals[cat] || 0) + Math.abs(Number(t.amount));
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    chart.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">No expenses this month yet.</div>';
    return;
  }

  const max = entries[0][1] || 1;
  chart.innerHTML = entries.map(([cat, amount]) => `
    <div style="display:grid;grid-template-columns:120px 1fr auto;gap:0.75rem;align-items:center;margin-bottom:0.85rem;">
      <div style="font-size:0.85rem">${cat}</div>
      <div style="height:10px;background:rgba(0,0,0,0.08);border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${(amount/max)*100}%;background:var(--accent);border-radius:999px;"></div>
      </div>
      <div style="font-size:0.82rem;color:var(--muted)">${fmt(amount, currency)}</div>
    </div>
  `).join('');
}

function renderAccounts(currency) {
  const list = document.getElementById('accountsList');
  list.innerHTML = '';
  if (appData.accounts.length === 0) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">No accounts yet. <a href="accounts.html">Add one →</a></div>';
    return;
  }
  appData.accounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div class="account-dot" style="background:${acc.color || '#ccc'}"></div>
        <div>
          <div style="font-weight:500">${acc.name}</div>
          <div style="font-size:0.7rem;color:var(--muted)">${acc.type}</div>
        </div>
      </div>
      <div style="font-weight:500">${fmt(acc.balance, currency)}</div>
    `;
    list.appendChild(item);
  });
}

function renderRecentTransactions(currency) {
  const list = document.getElementById('recentTxns');
  list.innerHTML = '';
  const recent = appData.transactions.slice(0, 5);
  if (recent.length === 0) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">No transactions yet. <a href="transactions.html">Add one →</a></div>';
    return;
  }
  recent.forEach(t => {
    const row    = document.createElement('div');
    row.className = 'transaction-row';
    const isNeg  = t.type === 'expense';
    const amount = Math.abs(Number(t.amount));
    row.innerHTML = `
      <div>
        <div style="font-weight:500">${t.description}</div>
        <div style="font-size:0.7rem;color:var(--muted)">${t.category} • ${new Date(t.transaction_date).toLocaleDateString()}</div>
      </div>
      <div style="font-weight:500;color:${isNeg ? 'var(--neg)' : 'var(--pos)'}">
        ${isNeg ? '-' : '+'}${fmt(amount, currency)}
      </div>
    `;
    list.appendChild(row);
  });
}

function updateSidebar() {
  document.getElementById('sidebarName').textContent = session.user.name || 'You';
  document.getElementById('sidebarAvatar').textContent = (session.user.name || 'Y').charAt(0).toUpperCase();
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
window.openSidebar  = () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('open'); };
window.closeSidebar = () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('open'); };
window.logout       = () => { localStorage.removeItem('folo_session'); sessionStorage.clear(); window.location.replace('login.html'); };

// ─── Boot ─────────────────────────────────────────────────────────────────────
fetchAllData();
