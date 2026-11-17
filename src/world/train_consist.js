/* Which vehicles a train has (pure; train_art.js draws them). consist(style, real, seed) -> { livery, loco, items: [{ kind, label }] }: kinds are loco, sleeper, ac3, ac2, general, pantry, slr, emu, vande, vande_end,
   boxn, tank, container, brake. LEN has the length of each in metres (Indian Railways sizes). */
export const hash = (a, b = 0) => { let x = (a * 2654435761 + b * 40503 + 12345) >>> 0; x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0; return x / 4294967296; };
export const hstr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const LEN = { coach: 23.5, emu: 20.3, loco: 20.6, boxn: 10.7, tank: 11.2, container: 12.2, brake: 10.4 };
export const COLOURS = {
  lhb: { body: '#c0272d', skirt: '#8a8f96', roof: '#a3a7ad', stripe: '#c0272d' }, maroon: { body: '#8a1f2a', skirt: '#cfc7b4', roof: '#a3a7ad', stripe: '#d9cfb4' },
  icf: { body: '#2b57a0', skirt: '#2b57a0', roof: '#b4b8bd', stripe: '#f1f1ee' }, vande: { body: '#f1f3f4', skirt: '#1c4f8c', roof: '#c9cdd1', stripe: '#1c4f8c' },
  emu_wr: { body: '#f1f1ee', skirt: '#2a63b0', roof: '#b4b8bd', stripe: '#c8231f' }, emu_cr: { body: '#2557a7', skirt: '#f0f0f0', roof: '#b4b8bd', stripe: '#f2c230' },
};
export const LOCO = { green: { body: '#3b9a3f', band: '#b6e02c', accent: '#3b9a3f', text: '#ffffff' }, brown: { body: '#6b3d27', band: '#d8c9a8', accent: '#6b3d27', text: '#f1e6cc' }, blue: { body: '#2b4f93', band: '#eeeeee', accent: '#2b4f93', text: '#ffffff' }, red: { body: '#c8261f', band: '#f4f4f0', accent: '#f4f4f0', text: '#f2c230' }, yellow: { body: '#f0c01f', band: '#c8261f', accent: '#c8261f', text: '#7a1710' } };

/* the vehicles of a train, front to back: { kind, label? } kinds: loco, sleeper, ac3, ac2, general, pantry, slr, emu, boxn, tank, container, brake */
/* The loco of a train: its class and livery. Locomotive colour does NOT show the kind of service on Indian Railways (owner's reference sheet, 22 Nov 2026): blue is the common multi-purpose livery, red the older electric one, green the newer eco-themed one, brown is common on diesel freight locos, yellow is maintenance.
   So class and livery come from the seed, not from the train's kind. diesel: the line is not electrified. */
export function locoSpec(style, seed, diesel) {
  const r = hash(seed, 21), freight = style === 'freight';
  if (diesel) return freight ? { model: 'WDG-4', livery: r < 0.65 ? 'brown' : r < 0.85 ? 'green' : 'blue', diesel: true } : { model: 'WDP-4', livery: r < 0.5 ? 'green' : r < 0.8 ? 'blue' : 'brown', diesel: true };
  if (freight) return { model: r < 0.8 ? 'WAG-9' : 'WAG-12', livery: r < 0.6 ? 'blue' : 'green', diesel: false };
  if (style === 'passenger') return { model: r < 0.4 ? 'WAP-4' : 'WAP-7', livery: r < 0.4 ? 'red' : r < 0.8 ? 'blue' : 'green', diesel: false };
  return { model: r < 0.12 ? 'WAP-5' : 'WAP-7', livery: r < 0.5 ? 'blue' : r < 0.72 ? 'red' : 'green', diesel: false };
}

export function consist(style, real, seed = 0, opts = {}) {
  const r = (i, n) => Math.floor(hash(seed, i) * n), out = [];
  const livery = style === 'rajdhani' ? 'maroon' : style === 'express' ? (hash(seed, 3) < 0.6 ? 'lhb' : 'icf') : style === 'passenger' ? 'icf' : style === 'vande' ? 'vande' : style === 'emu_wr' ? 'emu_wr' : style === 'emu_cr' ? 'emu_cr' : null;
  if (style === 'emu_wr' || style === 'emu_cr') { for (let i = 0; i < 12; i++) out.push({ kind: 'emu', label: String(i + 1), end: i === 0 ? 1 : i === 11 ? -1 : 0 }); return { livery, loco: null, items: out }; }
  if (style === 'vande') { const n = hash(seed, 9) < 0.5 ? 8 : 16; for (let i = 0; i < n; i++) out.push({ kind: i === 0 || i === n - 1 ? 'vande_end' : 'vande', label: (i === 0 || i === n - 1 ? 'EC' : 'C') + (i + 1), end: i === 0 ? 1 : i === n - 1 ? -1 : 0 }); return { livery, loco: null, items: out }; }
  if (style === 'maintenance') { out.push({ kind: 'maint', label: 'TRACK MACHINE' }); const n = 1 + Math.floor(hash(seed, 12) * 3); for (let i = 0; i < n; i++) out.push({ kind: 'maint_wagon' }); return { livery: null, loco: 'yellow', items: out }; }
  const ls = locoSpec(style, seed, !!opts.diesel);
  if (style === 'freight') { const n = 18 + r(1, 10), wag = ['boxn', 'boxn', 'boxn', 'tank', 'container']; const pick = wag[r(2, wag.length)]; out.push({ kind: 'loco', label: ls.model, diesel: ls.diesel }); for (let i = 0; i < n; i++) out.push({ kind: hash(seed, 10 + (i >> 3)) < 0.55 ? pick : wag[Math.floor(hash(seed, 40 + i) * wag.length)] }); out.push({ kind: 'brake' }); return { livery: null, loco: ls.livery, items: out }; }
  out.push({ kind: 'loco', label: ls.model, diesel: ls.diesel });
  if (style === 'passenger') { for (let i = 0; i < 11; i++) out.push({ kind: i === 0 || i === 10 ? 'slr' : 'general', label: i === 0 || i === 10 ? 'SLR' : 'D' + i }); return { livery, loco: ls.livery, items: out }; }
  if (style === 'rajdhani') { out.push({ kind: 'slr', label: 'EOG' }); const b = 5 + r(4, 3), a = 2 + r(5, 2); for (let i = 1; i <= b; i++) out.push({ kind: 'ac3', label: 'B' + i }); out.push({ kind: 'pantry', label: 'PC' }); for (let i = 1; i <= a; i++) out.push({ kind: 'ac2', label: 'A' + i }); out.push({ kind: 'ac2', label: 'H1' }); out.push({ kind: 'slr', label: 'EOG' }); return { livery, loco: ls.livery, items: out }; }
  const s = 5 + r(6, 4), b = 2 + r(7, 3); out.push({ kind: 'general', label: 'GS' }); out.push({ kind: 'general', label: 'GS' }); for (let i = 1; i <= s; i++) out.push({ kind: 'sleeper', label: 'S' + i }); out.push({ kind: 'pantry', label: 'PC' }); for (let i = 1; i <= b; i++) out.push({ kind: 'ac3', label: 'B' + i }); out.push({ kind: 'ac2', label: 'A1' }); out.push({ kind: 'slr', label: 'SLR' });
  return { livery, loco: ls.livery, items: out };
}
export const lengthOf = kind => kind === 'loco' ? LEN.loco : kind === 'maint' ? 14 : kind === 'maint_wagon' ? 12 : kind === 'emu' ? LEN.emu : kind === 'vande' || kind === 'vande_end' ? LEN.coach : kind === 'boxn' ? LEN.boxn : kind === 'tank' ? LEN.tank : kind === 'container' ? LEN.container : kind === 'brake' ? LEN.brake : LEN.coach;


export const locoNumber = (seed, style) => (style === 'freight' ? 31000 : 30000) + Math.floor(hash(seed, 77) * 8999);
export const headcode = (style, real) => style === 'rajdhani' ? 'RAJDHANI EXPRESS' : style === 'vande' ? 'VANDE BHARAT' : style === 'passenger' ? 'PASSENGER' : style === 'freight' ? 'GOODS' : /duronto/i.test(real && real.name || '') ? 'DURONTO' : /shatabdi/i.test(real && real.name || '') ? 'SHATABDI' : /mail/i.test(real && real.name || '') ? 'MAIL EXPRESS' : 'SUPERFAST EXPRESS';

