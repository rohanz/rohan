// Ticking local time for the home hero corner (minute resolution).
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  document.querySelectorAll<HTMLElement>('[data-local-clock]').forEach((el) => {
    const tz = el.dataset.tz || 'Asia/Singapore';
    el.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date());
    el.setAttribute('datetime', new Date().toISOString());
  });
}
function init() {
  clearInterval(timer);
  if (!document.querySelector('[data-local-clock]')) return;
  tick();
  timer = setInterval(tick, 15_000);
}
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => clearInterval(timer));
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });

export {};
