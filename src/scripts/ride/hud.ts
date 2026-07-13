/** Opt-in frame-rate meter (set the shared namespaced key to '1', then reload; '0' or unset =
 *  off). Shows a rolling fps + a count of dropped frames (>1.5 vsyncs at the
 *  detected refresh rate) so real-machine stutter reports can be verified with
 *  numbers instead of feel. Runs its own rAF loop but does only ~1 DOM write
 *  every 250ms — cheap enough to not perturb what it measures. */
import { PERF_HUD_KEY } from './keys';

export function mountPerfHud() {
  if (typeof localStorage === 'undefined' || localStorage.getItem(PERF_HUD_KEY) !== '1') return;
  if (document.getElementById('perf-hud')) return;
  const hud = document.createElement('div');
  hud.id = 'perf-hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.style.cssText =
    'position:fixed;right:10px;bottom:10px;z-index:99999;padding:6px 10px;' +
    'font:700 12px/1.3 ui-monospace,monospace;color:#fff;background:rgba(20,20,20,0.85);' +
    'border-radius:8px;pointer-events:none;white-space:pre;';
  document.body.appendChild(hud);
  const deltas: number[] = [];
  let last = performance.now();
  let dropped = 0;
  let vsync = 16.7; // refined below from the observed p50
  let lastPaint = 0;
  const tick = (t: number) => {
    const dt = t - last;
    last = t;
    deltas.push(dt);
    if (deltas.length > 120) deltas.shift();
    if (dt > vsync * 1.5) dropped++;
    if (t - lastPaint > 250 && deltas.length > 30) {
      lastPaint = t;
      const sorted = [...deltas].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length / 2)];
      const worst = sorted[sorted.length - 1];
      vsync = Math.max(4, Math.min(p50, 34)); // track the display's actual cadence
      hud.textContent = `fps ${(1000 / p50).toFixed(0)}  worst ${worst.toFixed(0)}ms\ndropped ${dropped}`;
      hud.style.background = worst > vsync * 2 ? 'rgba(160,40,40,0.9)' : 'rgba(20,20,20,0.85)';
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
