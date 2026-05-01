function toggleMenu() {
    document.getElementById('mobileMenu').classList.toggle('open');
}

function toggle(qEl) {
    const item = qEl.parentElement;
    const wasOpen = item.classList.contains('open');

    item.closest('.faq-section').querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
    });

    if (!wasOpen) item.classList.add('open');
}

function filterFAQ() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const items = document.querySelectorAll('.faq-item');
    const sections = document.querySelectorAll('.faq-section');
    let totalVisible = 0;

    items.forEach(item => {
        const match = !q || item.textContent.toLowerCase().includes(q);
        item.classList.toggle('hidden', !match);
        if (match) totalVisible++;
    });

    sections.forEach(section => {
        const visibleItems = section.querySelectorAll('.faq-item:not(.hidden)').length;
        section.classList.toggle('hidden', visibleItems === 0);
    });

    document.getElementById('noResults').style.display = totalVisible === 0 ? 'block' : 'none';

    items.forEach(item => {
        item.classList.toggle('open', !!q && !item.classList.contains('hidden'));
    });
}

const catLinks = document.querySelectorAll('.cat-nav-list a');

function setActiveCat(id) {
    catLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.cat === id);
    });
}

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) setActiveCat(entry.target.dataset.cat);
    });
}, { rootMargin: '-20% 0px -60% 0px' });

document.querySelectorAll('.faq-section').forEach(section => observer.observe(section));

catLinks.forEach(link => {
    link.addEventListener('click', () => {
        setActiveCat(link.dataset.cat);
    });
});
