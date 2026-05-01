const session = JSON.parse(localStorage.getItem('folo_session'));
if (!session) window.location.href = 'login.html';
window.addEventListener('pageshow', () => {
    const activeSession = JSON.parse(localStorage.getItem('folo_session') || 'null');
    if (!activeSession || !activeSession.token) {
        window.location.replace('login.html');
    }
});

let budgets = [];
let transactions = [];
const BUDGET_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Savings', 'Other'];

async function readJsonResponse(res) {
    const raw = await res.text();
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error('The server returned an invalid response.');
    }
}

async function loadBudgets() {
    try {
        const res = await fetch(`api/data/get_data.php?userId=${session.user.id}`);
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to load budgets');

        budgets = data.budgets || [];
        transactions = data.transactions || [];
        populateCategoryOptions();
        renderBudgets();
        renderSummary();
        updateSidebar();
    } catch (error) {
        console.error('Failed to load budgets:', error);
    }
}

async function saveBudget() {
    const cat = document.getElementById('fCat').value;
    const limit = parseFloat(document.getElementById('fLimit').value);

    if (!cat || !limit) return alert('Fill all fields');

    const res = await fetch('api/data/save_budget.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, category: cat, limit, period: 'monthly' })
    });

    const data = await readJsonResponse(res);
    if (!res.ok) {
        alert(data.error || 'Failed to save budget');
        return;
    }

    closeModal();
    document.getElementById('fLimit').value = '';
    loadBudgets();
}

function renderBudgets() {
    const container = document.getElementById('budgetsGrid');
    container.innerHTML = '';

    if (budgets.length === 0) {
        container.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">No budgets created yet.</div>';
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
        const perc = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

        const card = document.createElement('div');
        card.className = 'budget-card';
        card.innerHTML = `
            <div class="budget-header">
                <div class="budget-cat">${b.category}</div>
                <div class="budget-amt">${spent.toFixed(2)} / ${limit.toFixed(2)}</div>
            </div>
            <div class="progress-bg"><div class="progress-fill" style="width:${perc}%"></div></div>
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

    document.getElementById('budgetMonth').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('summaryStrip').innerHTML = `
        <div class="summary-pill">${budgets.length} budget${budgets.length !== 1 ? 's' : ''}</div>
        <div class="summary-pill">Planned: ${totalLimit.toFixed(2)}</div>
        <div class="summary-pill">Spent: ${totalSpent.toFixed(2)}</div>
    `;
}

function populateCategoryOptions() {
    const select = document.getElementById('fCat');
    if (!select) return;

    select.innerHTML = BUDGET_CATEGORIES.map(category => `<option value="${category}">${category}</option>`).join('');
}

function updateSidebar() {
    document.getElementById('sidebarName').textContent = session.user.name;
    document.getElementById('sidebarAvatar').textContent = session.user.name.charAt(0).toUpperCase();
}

function openModal() {
    document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
    document.getElementById('modalBackdrop').classList.remove('open');
}

function maybeClose(event) {
    if (event.target.id === 'modalBackdrop') closeModal();
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

loadBudgets();
