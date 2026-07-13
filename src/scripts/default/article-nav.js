let cleanups = [];

function setActive(items, slug) {
    const current = items.findIndex(item => item.dataset.target === slug);
    let parent = -1;
    if (current >= 0 && items[current].classList.contains('toc-h3')) {
        parent = Number.parseInt(items[current].dataset.parentIndex || '-1', 10);
    }
    items.forEach((item, index) => {
        item.classList.toggle('active', index === current);
        item.classList.toggle('parent-active', index === parent);
    });
}

export function init(root = document) {
    cleanup();
    const items = Array.from(root.querySelectorAll('#detailToc .toc-item[data-target]'));
    const headings = items
        .map(item => document.getElementById(item.dataset.target))
        .filter(Boolean);
    if (!items.length || !headings.length) return;

    let clickTarget = null;
    let settleTimer = 0;
    const compute = () => {
        if (clickTarget) return;
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
            setActive(items, headings[headings.length - 1].id);
            return;
        }
        let active = headings[0];
        headings.forEach(heading => {
            const trigger = innerHeight * (heading.tagName === 'H3' ? 0.38 : 0.5);
            if (heading.getBoundingClientRect().top <= trigger) active = heading;
        });
        setActive(items, active.id);
    };
    const onScroll = () => {
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            clickTarget = null;
            compute();
        }, 140);
        compute();
    };
    const onClick = event => {
        const item = event.target.closest('.toc-item[data-target]');
        if (!item) return;
        const heading = document.getElementById(item.dataset.target);
        if (!heading) return;
        event.preventDefault();
        clickTarget = item.dataset.target;
        setActive(items, clickTarget);
        const top = heading.getBoundingClientRect().top + scrollY - 90;
        scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        history.replaceState(null, '', `#${clickTarget}`);
        onScroll();
    };

    const toc = root.querySelector('#detailToc');
    toc.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    compute();
    cleanups.push(() => {
        clearTimeout(settleTimer);
        toc.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll);
    });
}

export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
}
