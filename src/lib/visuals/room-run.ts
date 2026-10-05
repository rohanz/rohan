// Room widgets, shared by every theme (styles in room-run.css, colours from
// the palette):
//   #room-arch      how Room is wired: two clones, their daemons and agents,
//                   the shared room and the browser view; pick a stage to see
//                   its path. Replaces the article's ASCII diagram.
//   #room-contract  the contract detector: make an edit to an example function
//                   and see what Room observes and who it tells. The rules are
//                   packages/shared/src/graph.ts as quoted in the article: a
//                   definition whose signature changed, or that was added or
//                   removed, is a contract change; body-only edits are not.

import type { VisualPalette } from './palette';

export interface RoomRunOptions {
  root: ParentNode;
  palette: () => VisualPalette;
  onThemeChange?: (redraw: () => void) => () => void;
}

const SVG = 'http://www.w3.org/2000/svg';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
};

function shell(node: HTMLElement, kicker: string, options: RoomRunOptions, cleanups: Array<() => void>) {
  node.textContent = '';
  const card = el('div', 'qla-visual room-run');
  const header = el('div', 'qla-visual-header');
  header.append(el('span', 'qla-visual-kicker', kicker));
  const body = el('div', 'qla-visual-body');
  card.append(header, body);
  node.append(card);
  const applyPalette = () => card.style.setProperty('--room-accent', options.palette().qla.compoundCurve);
  applyPalette();
  if (options.onThemeChange) cleanups.push(options.onThemeChange(applyPalette));
  return body;
}

function tabs(labels: string[], onPick: (i: number) => void, label: string) {
  const bar = el('div', 'qla2-episode-picker room-tabs');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', label);
  const buttons = labels.map((label, i) => {
    const b = el('button', 'qla-btn qla2-mode-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => onPick(i));
    bar.append(b);
    return b;
  });
  const setActive = (i: number) => buttons.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  return { bar, setActive };
}

// ------------------------------------------------------------ architecture
type Part = 'watchA' | 'watchB' | 'daemonA' | 'daemonB' | 'agentA' | 'agentB' | 'room' | 'browser' | 'merge';

const STAGES: Array<{ name: string; parts: Part[]; line: string }> = [
  { name: 'publish', parts: ['watchA', 'watchB', 'daemonA', 'daemonB', 'room'],
    line: 'Room watches the files each agent edits and shares the allowed changes. Other agents can read them before they are committed. Reading a teammate’s changes does not overwrite your own files.' },
  { name: 'announce', parts: ['agentA', 'agentB', 'daemonA', 'daemonB', 'room'],
    line: 'An agent shares a plan, claims the lines it intends to edit, or asks another agent a question. A claim tells teammates “I’m working here”; it does not lock the code. Those messages join the file changes in the shared room.' },
  { name: 'share', parts: ['room', 'daemonA', 'daemonB', 'browser'],
    line: 'Connected agents share a record of who is working on what, their latest edits, and their messages. You can follow the same activity in a browser without editing anyone’s work.' },
  { name: 'route', parts: ['daemonA', 'daemonB', 'room'],
    line: 'Room checks whether agents are editing overlapping code, or changing something another agent’s code uses. It uses those connections to decide who should hear about a change. A connection suggests a possible problem; tests still check whether the code works.' },
  { name: 'deliver', parts: ['room', 'daemonA', 'daemonB', 'agentA', 'agentB'],
    line: 'Room passes the notice to the affected agent: when it next uses a Room tool, before it edits a file, or by waking a waiting session when the coding app supports it.' },
  { name: 'preview', parts: ['watchA', 'watchB', 'merge'],
    line: 'Room combines unfinished changes in a temporary copy of the project. The agents can test that combined version before deciding which changes to bring into their own files.' },
];

function box(x: number, y: number, w: number, h: number, label: string, sub?: string) {
  const g = svg('g', { class: 'room-node' });
  g.append(svg('rect', { x, y, width: w, height: h, rx: 0 }));
  const t = svg('text', { x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 4), class: 'room-node-label' });
  t.textContent = label;
  g.append(t);
  if (sub) {
    const s = svg('text', { x: x + w / 2, y: y + h / 2 + 13, class: 'room-node-sub' });
    s.textContent = sub;
    g.append(s);
  }
  return g;
}

function mountArch(node: HTMLElement, options: RoomRunOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'how room is wired', options, cleanups);
  const chart = svg('svg', { viewBox: '0 44 640 250', class: 'room-arch', role: 'img', 'aria-label': 'Two clones, each with a file watcher, a Room MCP process and daemon, and an agent, joined through a shared room with a browser view and a merge preview' });
  const parts = new Map<Part, SVGElement>();
  const links: Array<{ from: Part; to: Part; path: SVGElement }> = [];
  const link = (from: Part, to: Part, d: string) => {
    const path = svg('path', { d, class: 'room-link', 'data-from': from, 'data-to': to });
    links.push({ from, to, path }); chart.append(path);
  };
  // links first so boxes sit on top
  link('watchA', 'daemonA', 'M88 236V206'); link('watchB', 'daemonB', 'M552 236V206');
  link('daemonA', 'room', 'M148 176H262'); link('daemonB', 'room', 'M492 176H378');
  link('daemonA', 'agentA', 'M88 146V106'); link('daemonB', 'agentB', 'M552 146V106');
  link('room', 'browser', 'M320 206V228');
  link('watchA', 'merge', 'M148 262C205 262 205 274 262 274'); link('watchB', 'merge', 'M492 262C435 262 435 274 378 274');
  const add = (id: Part, g: SVGElement) => { g.setAttribute('data-part', id); parts.set(id, g); chart.append(g); };
  add('agentA', box(28, 58, 120, 48, 'agent A', 'plans + questions'));
  add('agentB', box(492, 58, 120, 48, 'agent B', 'plans + questions'));
  add('daemonA', box(28, 146, 120, 60, 'Room MCP', 'watches + checks'));
  add('daemonB', box(492, 146, 120, 60, 'Room MCP', 'watches + checks'));
  add('watchA', box(28, 236, 120, 40, 'clone + watcher'));
  add('watchB', box(492, 236, 120, 40, 'clone + watcher'));
  add('room', box(262, 146, 116, 60, 'the room', 'shared activity'));
  add('browser', box(262, 228, 116, 28, 'browser view'));
  add('merge', box(262, 262, 116, 24, 'merge preview'));
  const caption = el('p', 'room-caption');
  caption.setAttribute('aria-live', 'polite');
  const modeNote = el('p', 'room-mode-note');
  const mobile = el('div', 'room-arch-mobile');
  mobile.setAttribute('role', 'group');
  mobile.setAttribute('aria-label', 'Room architecture');
  const peers = el('div', 'room-mobile-peers');
  const mobileParts = new Map<Part, HTMLElement>();
  const mobileBox = (id: Part, label: string, description: string) => {
    const card = el('div', 'room-mobile-node');
    card.append(el('strong', undefined, label), el('span', undefined, description));
    mobileParts.set(id, card); return card;
  };
  for (const side of ['A', 'B'] as const) {
    const peer = el('div', 'room-mobile-peer');
    peer.append(mobileBox(`agent${side}`, `Agent ${side}`, 'Shares plans and questions'),
      mobileBox(`daemon${side}`, 'Room MCP', 'Tools for sharing edits and coordinating work'),
      mobileBox(`watch${side}`, 'Project files', 'This agent’s copy'));
    peers.append(peer);
  }
  const mobileRoom = mobileBox('room', 'Local room', 'Shared edits, plans and messages');
  const outputs = el('div', 'room-mobile-outputs');
  outputs.append(mobileBox('browser', 'Browser view', 'Follow the activity'), mobileBox('merge', 'Merge preview', 'Try everyone’s changes together'));
  mobile.append(peers, mobileRoom, outputs);
  const mode = tabs(['local room', 'team room'], pickMode, 'Room connection');
  const { bar, setActive } = tabs(STAGES.map((s) => s.name), (i) => pick(i), 'Architecture stage');
  function pickMode(i: number) {
    mode.setActive(i);
    parts.get('room')!.querySelector('.room-node-label')!.textContent = i ? 'team server' : 'local room';
    parts.get('watchA')!.querySelector('.room-node-label')!.textContent = 'project files';
    parts.get('watchB')!.querySelector('.room-node-label')!.textContent = 'project files';
    mobileRoom.querySelector('strong')!.textContent = i ? 'Team server' : 'Local room';
    modeNote.textContent = i
      ? 'A team room connects separate clones through a shared server. You choose to join and what to share. Joining requires GitHub login and permission to push to the repository.'
      : 'A local room connects agents in the same checkout and its linked worktrees (separate working copies of the same repository) on your machine. No Room account is needed. Separately cloned copies get separate local rooms.';
  }
  const key = el('p', 'room-diagram-key', 'Accent marks the parts involved in this job. Other parts remain available.');
  body.append(mode.bar, modeNote, bar, caption, chart, mobile, key);
  function pick(i: number) {
    setActive(i);
    const lit = new Set(STAGES[i].parts);
    parts.forEach((p, id) => p.classList.toggle('is-lit', lit.has(id)));
    peers.classList.toggle('is-lit', lit.has('room'));
    mobileParts.forEach((p, id) => p.classList.toggle('is-lit', lit.has(id)));
    links.forEach(({ from, to, path }) => path.classList.toggle('is-lit', lit.has(from) && lit.has(to)));
    chart.setAttribute('aria-label', `${STAGES[i].name}: ${STAGES[i].line}`);
    caption.textContent = STAGES[i].line;
  }
  pickMode(0);
  pick(0);
}

// ------------------------------------------------------------ a concrete coordination example
function mountContract(node: HTMLElement, options: RoomRunOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'a change in one agent’s work can affect another', options, cleanups);
  body.append(el('p', 'room-example-intro', 'Three agents are building an online shop. The tax agent writes the tax calculator. The checkout agent uses that calculator to show the total. The profile agent works on customer names and does not use it.'));
  const audience = el('div', 'room-story-grid room-audience');
  const audienceStates: HTMLElement[] = [];
  for (const name of ['Tax agent', 'Checkout agent', 'Profile agent']) {
    const card = el('div', 'room-story-cell'); const status = el('p'); audienceStates.push(status);
    card.append(el('strong', undefined, name), status); audience.append(card);
  }
  const planned = [
    { label: 'announce', action: '“I’m going to make the tax calculator require a delivery address.”',
      before: 'Checkout sends the basket items to calculate tax.', after: 'Checkout would also need to send the delivery address.',
      result: 'Room tells the checkout agent about the plan, so it can prepare its part before the tax calculator changes.',
      note: 'This is a proposal. The tax code has not changed yet.', code: 'tax_for(items) → tax_for(items, address)' },
    { label: 'revise', action: '“Actually, I only need the country, not the full address.”',
      before: 'The earlier proposal asked checkout for a delivery address.', after: 'The revised proposal asks for just the country.',
      result: 'Room sends the updated plan to the checkout agent, so it knows which information to send.',
      note: 'The tax agent is changing its proposal, not editing the checkout agent’s code.', code: 'Proposed: tax_for(items, country)' },
    { label: 'cancel', action: '“I’m dropping that change. Keep using the calculator as it is.”',
      before: 'Checkout was preparing to send a delivery address.', after: 'The tax agent drops the address requirement; basket items will still be enough.',
      result: 'Room tells the checkout agent that the plan was dropped. If checkout already changed its code for that plan, its agent needs to decide what to undo.',
      note: 'Sending this message does not undo any code changes automatically.', code: 'Keep: tax_for(items)' },
  ];
  const detected = [
    { label: 'change the calculation', action: 'The tax agent changes how the answer is rounded.',
      before: 'Checkout sends the basket items to calculate tax.', after: 'Checkout still sends the same information.',
      result: 'Room shares the edited file, but sends no automatic interface-change notice. This detector looks for changed names and inputs, not changes to the calculation itself.',
      note: 'Tests are still needed: a different calculation can change the result.', code: 'Before: return total * rate\nAfter:  return round(total * rate, 2)', notify: false },
    { label: 'require an address', action: 'The tax agent edits the calculator to require a delivery address.',
      before: 'Checkout sends only the basket items.', after: 'The calculator now needs the items and a delivery address.',
      result: 'Room notices the new input and tells the checkout agent. Its code still uses the old version and may need updating.',
      note: 'The profile agent gets no notice in this example because its work does not use the calculator.', code: 'Before: tax_for(items)\nAfter:  tax_for(items, address)', notify: true },
    { label: 'rename the calculator', action: 'The tax agent gives the calculator a new name.',
      before: 'Checkout uses the old name: tax_for.', after: 'The calculator is now called sales_tax.',
      result: 'Room tells the checkout agent that the old name has disappeared. Checkout can then update the name it uses.',
      note: 'Room records the new name too. It sends this notice because the old one was removed.', code: 'Before: tax_for(items)\nAfter:  sales_tax(items)', notify: true },
    { label: 'remove the calculator', action: 'The tax agent deletes the calculator.',
      before: 'Checkout uses the calculator to work out tax.', after: 'That calculator no longer exists.',
      result: 'Room tells the checkout agent that something its code uses has been removed, so it can ask what should replace it.',
      note: 'Room draws attention to the dependency. The agents still need to agree on a fix.', code: 'Removed: tax_for(items)', notify: true },
  ];
  let source = 0;
  const action = el('p', 'room-example-action');
  const comparison = el('div', 'room-comparison');
  const before = el('p'); const after = el('p');
  for (const [label, text] of [['Before', before], ['What changes', after]] as const) {
    const cell = el('div'); cell.append(el('span', 'room-label', label), text); comparison.append(cell);
  }
  const result = el('p', 'room-example-result'); result.setAttribute('aria-live', 'polite');
  const note = el('p', 'room-example-note');
  const codeDetails = el('details', 'room-code-details');
  const code = el('pre', 'room-diff');
  const codeExplanation = el('p');
  codeDetails.append(el('summary', undefined, 'See the code example'), codeExplanation, code);
  const plannedTabs = tabs(planned.map(s => s.label), i => pick(i), 'Plan event');
  const detectedTabs = tabs(detected.map(s => s.label), i => pick(i), 'Detected edit');
  const actionLabel = el('span', 'room-label');
  const sourceTabs = tabs(['planned change', 'detected change'], i => {
    source = i; sourceExplanation.textContent = i === 0 ? 'Planned: the agent announces what it intends to change, before editing the code.' : 'Detected: Room notices a change in the code, even when the agent did not announce it.'; sourceTabs.setActive(i); plannedTabs.bar.hidden = i !== 0; detectedTabs.bar.hidden = i !== 1; pick(i === 0 ? 0 : 1);
  }, 'Change source');
  const sourceExplanation = el('p', 'room-mode-note');
  body.append(sourceTabs.bar, sourceExplanation, plannedTabs.bar, detectedTabs.bar, actionLabel, action, comparison,
    el('span', 'room-label', 'What Room does'), result, audience, note, codeDetails);
  function pick(i: number) {
    const scene = source === 0 ? planned[i] : detected[i];
    (source === 0 ? plannedTabs : detectedTabs).setActive(i);
    actionLabel.textContent = source === 0 ? 'The tax agent says' : 'The tax agent edits the code';
    action.textContent = scene.action; before.textContent = scene.before; after.textContent = scene.after;
    result.textContent = scene.result; note.textContent = scene.note; code.textContent = scene.code;
    codeExplanation.textContent = source === 1 && i === 0
      ? 'total is the basket price and rate is the tax rate. Multiplying them calculates the tax. round(..., 2) rounds that answer to two decimal places.'
      : 'tax_for is the calculator’s name. The words in parentheses are the information given to it: items means the basket, address means the delivery address, and country means its country. An arrow means “changes to”.';
    const notify = source === 0 || detected[i].notify;
    audienceStates[0].textContent = source === 0 ? 'Changes the plan' : 'Changes the calculator';
    audienceStates[1].textContent = notify ? 'Gets a notice · uses the calculator' : 'No notice · inputs stay the same';
    audienceStates[2].textContent = 'No notice · does not use the calculator';
    audienceStates[1].parentElement!.classList.toggle('is-relevant', notify);
  }
  sourceTabs.setActive(0); sourceExplanation.textContent = 'Planned: the agent announces what it intends to change, before editing the code.'; detectedTabs.bar.hidden = true; pick(0);
}

// Illustrative views of a job; no live agents or measured timings.
function mountLifecycle(node: HTMLElement, options: RoomRunOptions, cleanups: Array<() => void>) {
  const body = shell(node, 'one lead agent, three workers', options, cleanups);
  body.append(el('p', 'room-example-intro', 'You ask a lead agent to improve an online shop using Room workers. A worker is an agent the lead starts for a particular job. Each works in its own Git worktree - a separate working copy of the project.'));
  const scenes = [
    { label: 'work in parallel', states: ['Changes the tax calculator', 'Updates the checkout page', 'Tests the changes together'],
      message: 'The checkout agent asks the tax agent: “Does the new total include tax?”',
      detail: 'The workers can see each other’s unfinished changes and ask questions while they work.' },
    { label: 'follow up', states: ['Finished', 'Working again', 'Finished'],
      message: 'The lead asks the checkout agent: “Check what happens when the basket is empty.”',
      detail: 'Room resumes that worker’s conversation with its earlier context and code intact. The other workers do not need to start again.' },
    { label: 'preview + test', states: ['Finished', 'Finished', 'Tests the combined version'],
      message: 'The lead puts the workers’ changes together in a temporary copy of the project.',
      detail: 'This is a preview: it lets the lead test whether the pieces work together before bringing them into its own files. If tests fail, the workers can make corrections.' },
    { label: 'review hold', states: ['Available for corrections', 'Available for corrections', 'Available for corrections'],
      message: 'A reviewer can say: “Wait for my review before bringing these changes into the main working copy.”',
      detail: 'This optional review hold blocks new requests to bring the work in until the reviewer releases it. The lead can still test the work and ask workers for corrections.' },
    { label: 'collect', states: ['Changes brought back', 'Changes brought back', 'Changes brought back'],
      message: 'The lead brings the finished changes into its own project files. Room calls this “collecting”.',
      detail: 'The changes are ready to inspect, but are not committed or pushed to Git. If a file has conflicting edits, Room leaves that file untouched. After collection, that worker can no longer be resumed through Room.' },
  ];
  const grid = el('div', 'room-story-grid room-worker-grid');
  const statuses: HTMLElement[] = [];
  for (const name of ['Tax worker', 'Checkout worker', 'Test worker']) {
    const card = el('div', 'room-story-cell'); const status = el('p', 'room-worker-status'); statuses.push(status);
    card.append(el('strong', undefined, name), status); grid.append(card);
  }
  const message = el('p', 'room-story-message');
  const detail = el('p', 'room-caption'); detail.setAttribute('aria-live', 'polite');
  const { bar, setActive } = tabs(scenes.map(s => s.label), pick, 'Worker workflow');
  body.append(bar, message, grid, detail);
  function pick(i: number) {
    setActive(i); const scene = scenes[i];
    statuses.forEach((s, j) => { s.textContent = scene.states[j]; s.parentElement!.classList.toggle('is-relevant', i === 1 && j === 1); });
    message.textContent = scene.message; detail.textContent = scene.detail;
  }
  pick(0);
}

export function initRoomRun(options: RoomRunOptions): () => void {
  const arch = options.root.querySelector<HTMLElement>('#room-arch');
  const contract = options.root.querySelector<HTMLElement>('#room-contract');
  const lifecycle = options.root.querySelector<HTMLElement>("#room-lifecycle");
  if (!arch && !contract && !lifecycle) return () => {};
  const cleanups: Array<() => void> = [];
  if (lifecycle) mountLifecycle(lifecycle, options, cleanups);
  if (arch) mountArch(arch, options, cleanups);
  if (contract) mountContract(contract, options, cleanups);
  return () => { cleanups.splice(0).forEach((cleanup) => cleanup()); };
}
