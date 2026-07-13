// Ride-engine diagnostic log. Always-on ring buffer (cheap: plain object
// pushes, no DOM/string work) for chasing the rare "settled but empty
// platform" reports — by the time a user notices, the interesting events are
// long past, so we keep the last 400 engine events and dump on demand.
//
//   window.__rideLog()        → prints the buffer as a table, returns it
//   window.__rideLog(true)    → also copies a JSON dump to the clipboard
//
// The empty-platform self-heal calls dump() itself (console.warn) whenever it
// fires or sees something anomalous, so a repro screenshot of the console is
// enough to diagnose.

type Entry = { t: number; e: string; d?: unknown };

const BUF: Entry[] = [];
const CAP = 400;

export function rlog(e: string, d?: unknown) {
  BUF.push({ t: Math.round(performance.now()), e, d });
  if (BUF.length > CAP) BUF.splice(0, BUF.length - CAP);
}

export function rlogDump(label = 'ride log'): Entry[] {
  // Slice so later pushes don't mutate what the console displays lazily.
  const snap = BUF.slice();
  console.warn(`[ride] ${label} — ${snap.length} events (newest last)`);
  console.table(snap.map((x) => ({ t: x.t, e: x.e, d: x.d === undefined ? '' : JSON.stringify(x.d) })));
  return snap;
}

declare global {
  interface Window {
    __rideLog?: (copy?: boolean) => Entry[];
  }
}

if (typeof window !== 'undefined') {
  window.__rideLog = (copy = false) => {
    const snap = rlogDump('manual dump');
    if (copy) navigator.clipboard?.writeText(JSON.stringify(snap)).catch(() => {});
    return snap;
  };
}
