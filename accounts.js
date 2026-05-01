const session = JSON.parse(localStorage.getItem('folo_session'));
if (!session) window.location.href = 'login.html';
window.addEventListener('pageshow', () => {
    const activeSession = JSON.parse(localStorage.getItem('folo_session') || 'null');
    if (!activeSession || !activeSession.token) {
        window.location.replace('login.html');
    }
});

let accounts = [];
let selectedColor = '#588973';
const ACCOUNT_COLORS = ['#588973', '#3a5a8c', '#b86b5f', '#c59b5f', '#7b4f9e', '#4f8c7a'];

async function readJsonResponse(res) {
    const raw = await res.text();
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error('The server returned an invalid response.');
    }
}

async function loadAccounts() {
    try {
        const res = await fetch(`api/data/get_data.php?userId=${session.user.id}`);
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to load accounts');

        accounts = data.accounts || [];
        renderAccounts();
        renderNetWorth();
        populateAdjustAccounts();
        initSettings();
        initColorPicker();
        updateSidebar();
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

async function saveAccount() {
    const name = document.getElementById('fName').value.trim();
    const type = document.getElementById('fType').value;
    const bal = parseFloat(document.getElementById('fBalance').value) || 0;

    if (!name) return alert('Account name is required');

    const res = await fetch('api/data/add_account.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: session.user.id,
            name,
            type,
            balance: bal,
            color: selectedColor
        })
    });

    const data = await readJsonResponse(res);
    if (!res.ok) {
        alert(data.error || 'Failed to save account');
        return;
    }

    closeModal();
    document.getElementById('fName').value = '';
    document.getElementById('fBalance').value = '';
    loadAccounts();
}

function renderAccounts() {
    const container = document.getElementById('accountsGrid');
    container.innerHTML = '';

    if (accounts.length === 0) {
        container.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">No accounts added yet.</div>';
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
            <div class="account-balance">${new Intl.NumberFormat('en-US', { style: 'currency', currency: session.user.currency || 'USD' }).format(acc.balance)}</div>
            <div class="account-type">${acc.type}</div>
        `;
        container.appendChild(card);
    });
}

function renderNetWorth() {
    const total = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const currency = session.user.currency || 'USD';

    document.getElementById('nwBar').innerHTML = `
        <div class="summary-pill">Accounts: ${accounts.length}</div>
        <div class="summary-pill">Net worth: <strong>${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total)}</strong></div>
    `;
}

function initColorPicker() {
    const row = document.getElementById('colorRow');
    if (!row || row.dataset.ready === 'true') return;

    row.innerHTML = ACCOUNT_COLORS.map(color => `
        <button type="button" class="color-dot${color === selectedColor ? ' active' : ''}" data-color="${color}" style="background:${color};width:28px;height:28px;border-radius:999px;border:2px solid rgba(0,0,0,0.08)"></button>
    `).join('');

    row.addEventListener('click', event => {
        const button = event.target.closest('[data-color]');
        if (!button) return;
        selectedColor = button.dataset.color;
        row.querySelectorAll('[data-color]').forEach(el => {
            el.classList.toggle('active', el.dataset.color === selectedColor);
        });
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

function openAdjustModal() {
    document.getElementById('adjustBackdrop').classList.add('open');
}

function closeAdjustModal() {
    document.getElementById('adjustBackdrop').classList.remove('open');
}

function maybeCloseAdj(event) {
    if (event.target.id === 'adjustBackdrop') closeAdjustModal();
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

async function applyAdjust() {
    const accountId = document.getElementById('adjAcc').value;
    const balance = parseFloat(document.getElementById('adjBalance').value);

    if (!accountId || Number.isNaN(balance)) {
        alert('Select an account and enter a balance.');
        return;
    }

    const res = await fetch('api/data/update_account_balance.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, accountId, balance })
    });
    const data = await readJsonResponse(res);

    if (!res.ok) {
        alert(data.error || 'Failed to adjust balance');
        return;
    }

    document.getElementById('adjBalance').value = '';
    closeAdjustModal();
    loadAccounts();
}

function saveSettings() {
    const name = document.getElementById('settingName').value.trim();
    const currency = document.getElementById('settingCurrency').value;

    if (!name) {
        alert('Name is required.');
        return;
    }

    session.user.name = name;
    session.user.currency = currency;
    localStorage.setItem('folo_session', JSON.stringify(session));
    updateSidebar();
    renderAccounts();
    renderNetWorth();
    alert('Settings saved.');
}

function resetData() {
    alert('Reset all data is not connected to the backend yet.');
}

async function deleteUserAccount() {
    const confirmed = confirm('Send a secure delete link to your email? The link will expire in 10 minutes.');
    if (!confirmed) return;

    try {
        const res = await fetch('api/auth/request_delete_account.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.user.id })
        });
        const data = await readJsonResponse(res);

        if (!res.ok) {
            throw new Error(data.error || 'Failed to send delete link');
        }

        alert('A delete confirmation link has been sent to your email. It expires in 10 minutes.');
    } catch (error) {
        alert(error.message || 'Failed to send delete link');
    }
}

loadAccounts();
