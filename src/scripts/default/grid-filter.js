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
    let entranceTimer = null;

    // Once the page-entry stagger has finished, remove its gate permanently for
    // this document. Cards returning from display:none after a filter click then
    // appear immediately instead of replaying their entrance animation.
    if (grid.classList.contains('projects-entering')) {
        const delays = [...grid.querySelectorAll('.project-card')].map(card =>
            Number.parseFloat(getComputedStyle(card).animationDelay) || 0
        );
        entranceTimer = window.setTimeout(() => {
            grid.classList.remove('projects-entering');
            entranceTimer = null;
        }, (Math.max(0, ...delays) + 0.55) * 1000);
    }
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
        clearTimeout(entranceTimer);
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
