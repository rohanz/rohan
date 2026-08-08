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

function modelLabel(name: string): string { return MODEL_LABELS[name] ?? name; }
const MODEL_LABELS: Record<string, string> = {
  base: 'untrained (base 9B)',
  sft: 'after imitation (SFT)',
  grpo: 'final model (RL)',
  grpo_v2: 'RL variant v2',
  teacher: 'its teacher (frontier API)',
};

export function drawLadder(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  scores: Record<string, number>,
): void {
  const h = LADDER_HEIGHT;
  const names = Object.keys(scores);
  const pad = { l: Math.min(200, Math.max(165, w * 0.28)), r: 68, t: 18, b: 42 };
  const pw = w - pad.l - pad.r;
  const rowH = (h - pad.t - pad.b) / names.length;
  const min = 0.7;
  const max = 0.95;
  const x = (v: number) => pad.l + ((v - min) / (max - min)) * pw;
  ctx.clearRect(0, 0, w, h);

  ctx.font = `600 13px ${palette.fonts.ui}`;
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
    ctx.font = `${teacher ? 700 : 600} 13px ${palette.fonts.ui}`;
    ctx.textAlign = 'right';
    ctx.fillText(modelLabel(name), pad.l - 9, y + bh * 0.68);
    ctx.textAlign = 'left';
    ctx.fillText(`${(value * 100).toFixed(1)}%`, Math.min(w - 34, x(value) + 6), y + bh * 0.68);
  });
  ctx.fillStyle = palette.ink(0.5);
  ctx.font = `600 14px ${palette.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.fillText('evaluation reward', pad.l + pw / 2, h - 5);
}

export function drawRatchet(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  rows: RatchetRow[],
): void {
  const h = RATCHET_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  const runs = rows.filter((r) => r.status === 'success' && r.metric !== null);
  if (!runs.length) return;
  const pad = { l: 30, r: 30 };
  const gw = (w - pad.l - pad.r) / runs.length;
  const barW = Math.min(96, gw * 0.42);
  const y0 = h - 62;
  const lo = 0.76; const hi = 0.85;
  const scale = (v: number) => ((v - lo) / (hi - lo)) * (y0 - 46);
  runs.forEach((run, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const bh = scale(run.metric as number);
    const last = i === runs.length - 1;
    ctx.fillStyle = last ? palette.qla.compoundCurve : palette.ink(0.4);
    ctx.fillRect(cx - barW / 2, y0 - bh, barW, bh);
    ctx.textAlign = 'center';
    ctx.fillStyle = last ? palette.qla.compoundCurve : palette.ink(0.8);
    ctx.font = `700 14px ${palette.fonts.ui}`;
    ctx.fillText((run.metric as number).toFixed(3), cx, y0 - bh - 8);
    ctx.fillStyle = palette.ink(0.85); ctx.font = `700 13px ${palette.fonts.ui}`;
    ctx.fillText(`experiment ${i + 1}`, cx, y0 + 20);
    ctx.fillStyle = palette.ink(0.55); ctx.font = `600 12px ${palette.fonts.ui}`;
    ctx.fillText(`learning rate ${Number(run.lr).toExponential(0).replace('e-','e-')}`, cx, y0 + 38);
    if (i > 0) {
      const prev = runs[i - 1].metric as number;
      const delta = ((run.metric as number) - prev) * 100;
      ctx.fillStyle = palette.qla.compoundCurve; ctx.font = `700 13px ${palette.fonts.ui}`;
      ctx.fillText(`+${delta.toFixed(1)}`, cx - gw / 2, y0 - scale(prev) - 26);
    }
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.ink(0.5); ctx.font = `600 12px ${palette.fonts.ui}`;
  ctx.fillText('score on the frozen 150-question evaluation slice', pad.l, h - 6);
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
  ctx.font = `600 13px ${palette.fonts.ui}`;

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
      ctx.fillStyle = palette.qla.compoundCurve; ctx.font = `700 13px ${palette.fonts.ui}`;
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
      ctx.fillStyle = palette.ink(0.9); ctx.font = `700 13px ${palette.fonts.ui}`;
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
    ctx.font = `600 12px ${palette.fonts.ui}`;
    ctx.textAlign = i === 0 ? 'left' : i === costs.length - 1 ? 'right' : 'center';
    ctx.fillText(shortLabels[i] ?? modelLabel(row.phase), labelX, labelY);
  });
  ctx.fillStyle = palette.ink(0.5); ctx.font = `600 13px ${palette.fonts.ui}`;
  ctx.textAlign = 'left'; ctx.fillText('share of all-in cost', x0, 24);
  ctx.fillStyle = palette.ink(0.82); ctx.font = `700 18px ${palette.fonts.title}`;
  ctx.textAlign = 'right'; ctx.fillText(`$${total} total`, w - 12, 25);
}


export const PROMOTION_HEIGHT = 232;
export function drawPromotion(
  ctx: CanvasRenderingContext2D,
  { w, palette }: Qla2DrawOptions,
  ladder: Record<string, Record<string, number>>,
): void {
  const h = PROMOTION_HEIGHT;
  ctx.clearRect(0, 0, w, h);
  const groups: Array<{ label: string; note: string; a: number; b: number }> = [
    { label: 'validation set', note: 'the slice the agent optimized', a: ladder.val.grpo, b: ladder.val.grpo_v2 },
    { label: 'unseen question types', note: 'what it never measured', a: ladder.unseen_templates.grpo, b: ladder.unseen_templates.grpo_v2 },
  ];
  const pad = { l: 30, r: 30 };
  const gw = (w - pad.l - pad.r) / groups.length;
  const barW = Math.min(74, gw * 0.24);
  const y0 = 150; const scale = (v: number) => (v - 0.7) / 0.25 * 96;
  groups.forEach((g, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const better = g.b >= g.a;
    ctx.fillStyle = palette.ink(0.35);
    ctx.fillRect(cx - barW - 8, y0 - scale(g.a), barW, scale(g.a));
    ctx.fillStyle = better ? palette.qla.compoundCurve : palette.qla.agentComparison;
    ctx.fillRect(cx + 8, y0 - scale(g.b), barW, scale(g.b));
    ctx.textAlign = 'center';
    ctx.font = `700 13px ${palette.fonts.ui}`;
    ctx.fillStyle = palette.ink(0.75);
    ctx.fillText(`${(g.a * 100).toFixed(1)}%`, cx - barW / 2 - 8, y0 - scale(g.a) - 7);
    ctx.fillStyle = better ? palette.qla.compoundCurve : palette.qla.agentComparison;
    ctx.fillText(`${(g.b * 100).toFixed(1)}%`, cx + barW / 2 + 8, y0 - scale(g.b) - 7);
    ctx.fillStyle = palette.ink(0.85); ctx.font = `700 13px ${palette.fonts.ui}`;
    ctx.fillText(g.label, cx, y0 + 22);
    ctx.fillStyle = palette.ink(0.5); ctx.font = `600 12px ${palette.fonts.ui}`;
    ctx.fillText(g.note, cx, y0 + 40);
    const delta = (g.b - g.a) * 100;
    ctx.fillStyle = better ? palette.qla.compoundCurve : palette.qla.agentComparison;
    ctx.font = `700 14px ${palette.fonts.ui}`;
    ctx.fillText(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`, cx, 26);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.ink(0.5); ctx.font = `600 12px ${palette.fonts.ui}`;
  ctx.fillText('grey = old recipe · colored = the agent\u2019s recipe, trained at full scale', pad.l, h - 6);
}
