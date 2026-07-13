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

    const mainContent = root.querySelector('#mainContent') || document.getElementById('mainContent');
    const mainContentScrolls = Boolean(
        mainContent
        && mainContent.scrollHeight > mainContent.clientHeight + 2
        && ['auto', 'scroll'].includes(getComputedStyle(mainContent).overflowY)
    );
    const scrollTarget = mainContentScrolls ? mainContent : window;
    const scrollElement = mainContentScrolls ? mainContent : document.scrollingElement;
    let clickTarget = null;
    let settleTimer = 0;
    const settleClick = () => {
        if (!clickTarget) return;
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            const landedTarget = clickTarget;
            clickTarget = null;
            setActive(items, landedTarget);
        }, 180);
    };
    const compute = () => {
        if (clickTarget) return;
        if (scrollElement.scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - 12) {
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
        settleClick();
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
        const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        if (mainContentScrolls) {
            const containerTop = mainContent.getBoundingClientRect().top;
            const top = mainContent.scrollTop + heading.getBoundingClientRect().top - containerTop - innerHeight * 0.5;
            mainContent.scrollTo({ top: Math.max(0, top), behavior });
        } else {
            const top = heading.getBoundingClientRect().top + scrollY - innerHeight * 0.5;
            scrollTo({ top: Math.max(0, top), behavior });
        }
        history.replaceState(null, '', `#${clickTarget}`);
        settleClick();
    };

    const toc = root.querySelector('#detailToc');
    toc.addEventListener('click', onClick);
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    compute();
    cleanups.push(() => {
        clearTimeout(settleTimer);
        toc.removeEventListener('click', onClick);
        scrollTarget.removeEventListener('scroll', onScroll);
    });
}

export function cleanup() {
    cleanups.splice(0).forEach(fn => fn());
}
