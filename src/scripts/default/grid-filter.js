let cleanupFilter = null;

function setActiveFilterTag(filterBar, tag) {
    filterBar.querySelectorAll('.filter-tag').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
    });
    if (tag) {
        tag.classList.add('active');
        tag.setAttribute('aria-pressed', 'true');
    }
}

function initFilterHandlers(root) {
    const filterBar = root.querySelector('#projectsFilterBar');
    const grid = root.querySelector('#projectsGrid');
    if (!filterBar || !grid) return;

    let activeFilter = 'all';
    let filterTimer = null;
    const filterProjectCards = () => {
        grid.classList.add('filtering');
        clearTimeout(filterTimer);
        filterTimer = window.setTimeout(() => {
            grid.querySelectorAll('.project-card').forEach(card => {
                const cardTechs = (card.dataset.techs || '').split(',');
                const match = activeFilter === 'all' || activeFilter.split('||').some(t => cardTechs.includes(t));
                card.classList.toggle('hidden', !match);
            });
            grid.classList.remove('filtering');
        }, 250);
    };
    const onClick = e => {
        const tag = e.target.closest('.filter-tag');
        if (!tag || !filterBar.contains(tag)) return;
        setActiveFilterTag(filterBar, tag);
        activeFilter = tag.dataset.filter;
        filterProjectCards();
    };

    filterBar.addEventListener('click', onClick);
    cleanupFilter = () => {
        clearTimeout(filterTimer);
        grid.classList.remove('filtering');
        filterBar.removeEventListener('click', onClick);
        cleanupFilter = null;
    };
}

export function init(root = document) {
    cleanup();
    initFilterHandlers(root);
}

export function cleanup() {
    if (cleanupFilter) cleanupFilter();
}
