// Shared palette + dimensions. Every module reads sizes from here.
export const FONT = "'Be Vietnam Pro', ui-monospace, monospace";

// PALETTE EXPERIMENT (local branch): main ink navy, chrome grey, crimson
// demoted to accent-only. Original: ink #C74B50, accent #1F2A56.
export const COLORS = {
  cream: 0xFFF8E1,
  ink: 0x1F2A56,
  inkDim: 'rgba(31, 42, 86, 0.35)',
  inkCss: '#1F2A56',
  creamCss: '#FFF8E1',
  accent: 0xC74B50,
  accentCss: '#C74B50',
  accentDim: 'rgba(199, 75, 80, 0.35)',
  sky: 0x4A63B0,        // blueprint blue — room signage (one step deeper than the
  skyCss: '#4A63B0',    // charts' light navy #5C77C4, so signs hold up at distance)
};

export const ROOM = {
  w: 6,      // x
  d: 4,      // z
  h: 2.8,    // y
  wallT: 0.12,
  doorW: 0.9,
  doorH: 2.1,
};

// Workshop (SCENE01 projects room) has its own footprint.
export const WORKSHOP_ROOM = { w: 5.4, d: 5, h: 2.8, wallT: 0.12 };

// Furniture anchor positions (metres, room centred on origin, floor at y=0)
export const LAYOUT = {
  console:  { x: 0,    y: 0,   z: -1.35, ry: Math.PI },  // surface faces the room
  rack:     { x: -2.3, y: 0,   z: -1.3,  ry: 0.35 },
  monitorL: { x: -1.85, y: 0,  z: -1.72, ry: 0.35 },
  monitorR: { x: 1.85, y: 0,   z: -1.72, ry: -0.35 },
  couch:    { x: 0,    y: 0,   z: 1.45,  ry: Math.PI },
};

export const VIEWS = {
  // The resting view IS the engineer's seat — the studio needs no separate
  // room overview (walls are opaque hidden-line solids anyway).
  OVERVIEW: { pos: [0, 1.51, 0.32], look: [0, 0.94, -1.4], driftScale: 0.85 }, // a touch calmer at the console
  CONSOLE:  { pos: [0, 1.51, 0.32],  look: [0, 0.94, -1.4] },
  RACK:     { pos: [-1.2, 1.4, 0.2], look: [-2.3, 1.0, -1.3] },
  COUCH:    { pos: [0.4, 1.5, -0.6], look: [0, 0.7, 1.45] },
  // Room-local seats. main.js adds the plan-derived group position before
  // handing these views to the transit and rig.
  // Close on the sheet wall so each drawing reads big.
  WORKSHOP: { pos: [0, 1.6, 0.38], look: [0, 1.5, -2.5], driftScale: 0.72 }, // calmer at the sheet wall
  // Reading pose: near-overhead on the coffee-table spec sheet, so the
  // entrance barely pans up — the paper IS the destination.
  LOUNGE:   { pos: [0, 1.42, 0.52], look: [0, 0.468, 0.1], driftScale: 0.28 }, // close-up view: full parallax reads as lurching
};
