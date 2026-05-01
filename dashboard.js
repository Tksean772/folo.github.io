const session = JSON.parse(localStorage.getItem('folo_session') || 'null');
if (!session || !session.token) {
    window.location.replace('login.html');
}
window.addEventListener('pageshow', () => {
    const activeSession = JSON.parse(localStorage.getItem('folo_session') || 'null');
    if (!activeSession || !activeSession.token) {
        window.location.replace('login.html');
    }
});

let appData = {
    accounts: [],
    transactions: [],
    budgets: []
};

async function fetchAllData() {
    try {
        const response = await fetch(`api/data/get_data.php?userId=${session.user.id}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load dashboard data');
        }

        appData = data;
        renderDashboard();
        updateSidebar();
    } catch (error) {
        console.error('Dashboard load failed:', error);
    }
}

function renderDashboard() {
    const currency = session.user.currency || 'USD';
    const netWorth = appData.accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

    const now = new Date();
    const currentMonthTxns = appData.transactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = currentMonthTxns
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const expenses = currentMonthTxns
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;

    document.getElementById('statNetWorth').textContent = formatMoney(netWorth, currency);
    document.getElementById('statIncome').textContent = formatMoney(income, currency);
    document.getElementById('statExpenses').textContent = formatMoney(expenses, currency);
    document.getElementById('statSavings').textContent = savingsRate + '%';

    renderCategoryChart(currentMonthTxns);
    renderAccounts();
    renderRecentTransactions();
}

function formatMoney(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
    }).format(Number(amount) || 0);
}

function renderCategoryChart(currentMonthTxns) {
    const chart = document.getElementById('categoryChart');
    const spendMonth = document.getElementById('spendMonth');
    const now = new Date();

    spendMonth.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const totals = {};
    currentMonthTxns
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const category = t.category || 'Other';
            totals[category] = (totals[category] || 0) + Math.abs(Number(t.amount));
        });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        chart.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--muted)">No expenses this month yet.</div>';
        return;
    }

    const maxAmount = entries[0][1] || 1;
    chart.innerHTML = entries.map(([category, amount]) => `
        <div style="display:grid; grid-template-columns:120px 1fr auto; gap:0.75rem; align-items:center; margin-bottom:0.85rem;">
            <div style="font-size:0.85rem">${category}</div>
            <div style="height:10px; background:rgba(0,0,0,0.08); border-radius:999px; overflow:hidden;">
                <div style="height:100%; width:${(amount / maxAmount) * 100}%; background:var(--accent); border-radius:999px;"></div>
            </div>
            <div style="font-size:0.82rem; color:var(--muted)">${formatMoney(amount, session.user.currency)}</div>
        </div>
    `).join('');
}

function renderAccounts() {
    const list = document.getElementById('accountsList');
    list.innerHTML = '';

    if (appData.accounts.length === 0) {
        list.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--muted)">No accounts found.</div>';
        return;
    }

    appData.accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.75rem">
                <div class="account-dot" style="background:${acc.color || '#ccc'}"></div>
                <div>
                    <div style="font-weight:500">${acc.name}</div>
                    <div style="font-size:0.7rem; color:var(--muted)">${acc.type}</div>
                </div>
            </div>
            <div style="font-weight:500">${formatMoney(acc.balance, session.user.currency)}</div>
        `;
        list.appendChild(item);
    });
}

function renderRecentTransactions() {
    const list = document.getElementById('recentTxns');
    list.innerHTML = '';

    const recent = appData.transactions.slice(0, 5);
    if (recent.length === 0) {
        list.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--muted)">No transactions found.</div>';
        return;
    }

    recent.forEach(t => {
        const row = document.createElement('div');
        row.className = 'transaction-row';
        const isNeg = t.type === 'expense';
        const amount = Math.abs(Number(t.amount));

        row.innerHTML = `
            <div>
                <div style="font-weight:500">${t.description}</div>
                <div style="font-size:0.7rem; color:var(--muted)">${t.category} • ${new Date(t.transaction_date).toLocaleDateString()}</div>
            </div>
            <div style="font-weight:500; color:${isNeg ? 'var(--neg)' : 'var(--pos)'}">
                ${isNeg ? '-' : '+'}${formatMoney(amount, session.user.currency)}
            </div>
        `;
        list.appendChild(row);
    });
}

function updateSidebar() {
    document.getElementById('sidebarName').textContent = session.user.name;
    document.getElementById('sidebarAvatar').textContent = session.user.name.charAt(0).toUpperCase();
    document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
}

function logout() {
    localStorage.removeItem('folo_session');
    sessionStorage.clear();
    window.location.replace('login.html');
}

fetchAllData();
