// Canvas renderers for the quantlab-agentic article. Pure drawing functions:
// callers own DOM, animation state, sizing and theme selection.

import type { VisualPalette } from './palette';

export interface Qla2DrawOptions { w: number; palette: VisualPalette }
export interface RatchetRow { status: string; metric: number | null; cost: number; lr: number }
export interface BenchRow {
  workload: string;
  concurrency: string;
  rps: string;
  tokens_per_s: string;
}

export const LADDER_HEIGHT = 280;
export const RATCHET_HEIGHT = 205;
export const BENCH_HEIGHT = 286;
export const COSTS_HEIGHT = 205;

const modelLabel = (name: string) => name.replace(/_/g, ' ');

export function drawLadder(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  scores: Record<string, number>,
): void {
  const h = LADDER_HEIGHT;
  const names = Object.keys(scores);
  const pad = { l: Math.min(116, Math.max(88, w * 0.19)), r: 46, t: 18, b: 42 };
  const pw = w - pad.l - pad.r;
  const rowH = (h - pad.t - pad.b) / names.length;
  const min = 0.7;
  const max = 0.95;
  const x = (v: number) => pad.l + ((v - min) / (max - min)) * pw;
  ctx.clearRect(0, 0, w, h);

  ctx.font = `600 10px ${palette.fonts.ui}`;
  [0.7, 0.75, 0.8, 0.85, 0.9, 0.95].forEach((tick) => {
    const tx = x(tick);
    ctx.strokeStyle = palette.ink(0.12);
    ctx.beginPath(); ctx.moveTo(tx, pad.t); ctx.lineTo(tx, h - pad.b); ctx.stroke();
    ctx.fillStyle = palette.ink(0.5);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(tick * 100)}%`, tx, h - 23);
  });

  names.forEach((name, i) => {
    const value = scores[name];
    const y = pad.t + i * rowH + rowH * 0.2;
    const bh = rowH * 0.58;
    const teacher = name === 'teacher';
    ctx.fillStyle = palette.ink(0.08);
    ctx.fillRect(pad.l, y, pw, bh);
    ctx.fillStyle = teacher ? palette.ink(0.06) : palette.qla.compoundCurve;
    ctx.fillRect(pad.l, y, Math.max(0, x(value) - pad.l), bh);
    if (teacher) {
      ctx.strokeStyle = palette.qla.agentComparison;
      ctx.lineWidth = 2;
      ctx.strokeRect(pad.l + 1, y + 1, Math.max(0, x(value) - pad.l - 2), bh - 2);
    }
    ctx.fillStyle = teacher ? palette.qla.agentComparison : palette.ink(0.72);
    ctx.font = `${teacher ? 700 : 600} 11px ${palette.fonts.ui}`;
    ctx.textAlign = 'right';
    ctx.fillText(modelLabel(name), pad.l - 9, y + bh * 0.68);
    ctx.textAlign = 'left';
    ctx.fillText(`${(value * 100).toFixed(1)}%`, Math.min(w - 34, x(value) + 6), y + bh * 0.68);
  });
  ctx.fillStyle = palette.ink(0.5);
  ctx.font = `600 11px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.fillText('evaluation reward', pad.l + pw / 2, h - 5);
}

export function drawRatchet(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  rows: RatchetRow[],
): void {
  const h = RATCHET_HEIGHT;
  const pad = { l: 36, r: 36 };
  const pw = w - pad.l - pad.r;
  const x = (i: number) => pad.l + (rows.length === 1 ? pw / 2 : (i / (rows.length - 1)) * pw);
  const railY = 92;
  ctx.clearRect(0, 0, w, h);

  // One quiet annotation replaces the old collision-prone learning-rate arcs.
  ctx.strokeStyle = palette.ink(0.18);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x(2), 26); ctx.lineTo(x(4), 26); ctx.stroke();
  ctx.fillStyle = palette.ink(0.58);
  ctx.font = `600 10px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.fillText('agent raised lr ×5 then ×2', (x(2) + x(4)) / 2, 17);

  ctx.strokeStyle = palette.ink(0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x(0), railY); ctx.lineTo(x(rows.length - 1), railY); ctx.stroke();

  rows.forEach((row, i) => {
    const nx = x(i);
    const success = row.status === 'success';
    ctx.beginPath(); ctx.arc(nx, railY, 6, 0, Math.PI * 2);
    if (success) { ctx.fillStyle = palette.qla.compoundCurve; ctx.fill(); }
    else { ctx.fillStyle = palette.ink(0.04); ctx.fill(); ctx.strokeStyle = palette.ink(0.38); ctx.lineWidth = 1.5; ctx.stroke(); }

    ctx.textAlign = 'center';
    ctx.font = `700 11px ${palette.fonts.ui}`;
    ctx.fillStyle = success ? palette.ink(0.82) : palette.ink(0.48);
    ctx.fillText(row.metric === null ? 'serve failed' : row.metric.toFixed(3), nx, 67);
    ctx.font = `600 10px ${palette.fonts.ui}`;
    ctx.fillStyle = palette.ink(0.58);
    ctx.fillText(`lr ${row.lr.toExponential(0)}`, nx, 121);
    ctx.font = `600 9px ${palette.fonts.ui}`;
    ctx.fillStyle = palette.ink(0.42);
    ctx.fillText(`run ${i + 1} · $${row.cost.toFixed(2)}`, nx, 145);
  });
}

function benchSeries(rows: BenchRow[], mode: 'tokens' | 'episodes'): Array<{ x: number; y: number }> {
  const workload = mode === 'tokens' ? 'synthetic' : 'real_episode';
  return rows.filter((row) => row.workload === workload).map((row) => ({
    x: Number(row.concurrency),
    y: mode === 'tokens' ? Number(row.tokens_per_s) : Number(row.rps) * 60,
  }));
}

export function drawBench(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  bench: { bf16: BenchRow[]; fp8: BenchRow[] },
  mode: 'tokens' | 'episodes',
): void {
  const h = BENCH_HEIGHT;
  const pad = { l: 66, r: 22, t: 24, b: 48 };
  const bf16 = benchSeries(bench.bf16, mode);
  const fp8 = benchSeries(bench.fp8, mode);
  const maxY = Math.max(...bf16.map((p) => p.y), ...fp8.map((p) => p.y)) * 1.12;
  const xs = bf16.map((p) => p.x);
  const x = (v: number) => pad.l + (xs.indexOf(v) / (xs.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  ctx.clearRect(0, 0, w, h);
  ctx.font = `600 10px ${palette.fonts.ui}`;

  [0, 0.5, 1].forEach((f) => {
    const value = maxY * f;
    ctx.strokeStyle = palette.ink(0.12);
    ctx.beginPath(); ctx.moveTo(pad.l, y(value)); ctx.lineTo(w - pad.r, y(value)); ctx.stroke();
    ctx.fillStyle = palette.ink(0.5); ctx.textAlign = 'right';
    ctx.fillText(mode === 'tokens' ? Math.round(value).toLocaleString() : value.toFixed(0), pad.l - 6, y(value) + 3);
  });
  xs.forEach((value) => {
    ctx.fillStyle = palette.ink(0.55); ctx.textAlign = 'center';
    ctx.fillText(String(value), x(value), h - 19);
  });
  ctx.fillStyle = palette.ink(0.55); ctx.fillText('concurrent requests', (pad.l + w - pad.r) / 2, h - 5);
  ctx.save();
  ctx.translate(13, pad.t + (h - pad.t - pad.b) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(mode === 'tokens' ? 'tokens per second' : 'episodes per minute', 0, 0);
  ctx.restore();

  const drawLine = (points: Array<{ x: number; y: number }>, color: string, dashed: boolean) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
    ctx.setLineDash(dashed ? [6, 4] : []); ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(x(point.x), y(point.y)) : ctx.moveTo(x(point.x), y(point.y)));
    ctx.stroke(); ctx.setLineDash([]);
    points.forEach((point) => { ctx.beginPath(); ctx.arc(x(point.x), y(point.y), 3.5, 0, Math.PI * 2); ctx.fill(); });
  };
  drawLine(bf16, palette.qla.compoundCurve, false);
  drawLine(fp8, palette.qla.agentComparison, true);

  if (mode === 'episodes') {
    const a = bf16.find((p) => p.x === 16);
    const b = bf16.find((p) => p.x === 32);
    if (a && b && b.y < a.y) {
      const drop = Math.round((1 - b.y / a.y) * 100);
      ctx.strokeStyle = palette.qla.compoundCurve; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x(a.x) + 4, y(a.y) - 8); ctx.lineTo(x(b.x) - 4, y(b.y) - 8); ctx.stroke();
      ctx.fillStyle = palette.qla.compoundCurve; ctx.font = `700 10px ${palette.fonts.ui}`;
      ctx.textAlign = 'center'; ctx.fillText(`bf16: ${drop}% drop`, (x(a.x) + x(b.x)) / 2, Math.min(y(a.y), y(b.y)) - 15);
    }
  }
}

export function drawCosts(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  costs: Array<{ phase: string; usd: number }>,
): void {
  const h = COSTS_HEIGHT;
  const total = costs.reduce((sum, row) => sum + row.usd, 0);
  const x0 = 12, y0 = 42, bh = 42, pw = w - 24;
  const shortLabels = ['API', 'SFT', 'GRPO v1', 'GRPO v2', 'autoresearch', 'eval serving', 'benchmarks'];
  ctx.clearRect(0, 0, w, h);
  let cursor = x0;
  const segmentMids: number[] = [];
  costs.forEach((row, i) => {
    const sw = (row.usd / total) * pw;
    segmentMids.push(cursor + sw / 2);
    ctx.fillStyle = i % 2 ? palette.qla.agentComparison : palette.qla.compoundCurve;
    ctx.globalAlpha = 0.58 + (i % 3) * 0.18;
    ctx.fillRect(cursor, y0, sw, bh);
    ctx.globalAlpha = 1;
    if (sw > 42) {
      ctx.fillStyle = palette.ink(0.9); ctx.font = `700 10px ${palette.fonts.ui}`;
      ctx.textAlign = 'center'; ctx.fillText(`$${row.usd}`, cursor + sw / 2, y0 + 25);
    }
    cursor += sw;
  });
  ctx.strokeStyle = palette.ink(0.35); ctx.strokeRect(x0, y0, pw, bh);
  costs.forEach((row, i) => {
    const labelX = costs.length === 1 ? x0 + pw / 2 : x0 + (i / (costs.length - 1)) * pw;
    const labelY = 117 + (i % 2) * 30;
    ctx.strokeStyle = palette.ink(0.18);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(segmentMids[i], y0 + bh); ctx.lineTo(labelX, labelY - 11); ctx.stroke();
    ctx.fillStyle = palette.ink(0.62);
    ctx.font = `600 9px ${palette.fonts.ui}`;
    ctx.textAlign = i === 0 ? 'left' : i === costs.length - 1 ? 'right' : 'center';
    ctx.fillText(shortLabels[i] ?? modelLabel(row.phase), labelX, labelY);
  });
  ctx.fillStyle = palette.ink(0.5); ctx.font = `600 10px ${palette.fonts.ui}`;
  ctx.textAlign = 'left'; ctx.fillText('share of all-in cost', x0, 24);
  ctx.fillStyle = palette.ink(0.82); ctx.font = `700 18px ${palette.fonts.title}`;
  ctx.textAlign = 'right'; ctx.fillText(`$${total} total`, w - 12, 25);
}
