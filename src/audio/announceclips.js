/* Real station announcement recordings, when the owner has put them in assets/audio/announce/ with a manifest.json (see the README there).
   Each manifest entry: { file, city, kind ('arriving' | 'departing' | 'welcome' | 'any'), lang ('mr', 'hi', 'en', ...), train (a train number the clip names, optional), generic (true when the clip names no train and fits any), credit, url, title }.
   pickClip chooses the clip for an event: a clip that names the very train first, then a generic clip of the station (a clip with no city fits any station); none means "use the synthesised voice".
   The recordings (a YouTube playlist the owner shared, 22 Nov 2026) are NOT downloaded by the game's tools and are not in the repository: the owner supplies the files; they are git-ignored and listed as
   "pending legal review" in licenses.html until the owner's lawyer has cleared them (docs/OPEN_DATA.md). Without a manifest nothing changes. */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

/* manifest: array of entries; ev: { city, kind, train, langs: ['mr', 'hi', 'en'] (the station's languages in order of preference), seed } -> an entry or null */
export function pickClip(manifest, ev) {
  if (!Array.isArray(manifest) || !manifest.length) return null; const fits = c => !c.kind || c.kind === 'any' || c.kind === ev.kind, langRank = c => { const i = (ev.langs || []).indexOf(c.lang); return i < 0 ? (c.lang ? 9 : 5) : i; };
  const score = c => { if (!fits(c)) return -1; let s = 0;
    if (ev.train && c.train && String(c.train) === String(ev.train)) s += 100; else if (c.train) return -1;                    // a clip that names another train is wrong here
    else if (c.generic !== true) return -1;
    if (c.city && c.city === ev.city) s += 40; else if (c.city) return -1;                                                    // a recording made at another station is wrong here
    s += 10 - Math.min(9, langRank(c)); return s; };
  let best = null, bs = 0, n = 0; for (const c of manifest) { const s = score(c); if (s > bs) { bs = s; best = c; n = 1; } else if (s === bs && s > 0) { n++; if (hash(String(ev.seed || '') + c.file) < 1 / n) best = c; } }
  return best;
}

export class AnnounceClips {
  constructor(sound, base = 'assets/audio/announce/') { this.s = sound; this.base = base; this.manifest = null; this.buf = new Map(); this.tried = false; this.playing = null; this.last = 0; }
  load() { if (this.tried) return; this.tried = true; fetch(this.base + 'manifest.json').then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then(m => { this.manifest = Array.isArray(m) ? m : (m.clips || []); }).catch(() => { this.manifest = []; }); }
  get ok() { return !!(this.manifest && this.manifest.length); }
  pick(ev) { return this.ok ? pickClip(this.manifest, ev) : null; }
  /* play a clip (fetched and decoded on first use); returns true if it started or is about to; one at a time, at most one every 10 s */
  play(clip, now) {
    if (!clip || !this.s.ctx || this.s.sfx === 0 || now - this.last < 10000) return false; this.last = now; const c = this.s.ctx, go = b => { if (this.playing) { try { this.playing.stop(); } catch (e) { /* ended */ } } const src = c.createBufferSource(), g = c.createGain(); src.buffer = b; g.gain.value = 0.9; src.connect(g); g.connect(this.s.sfxBus || c.destination); src.start(0); this.playing = src; };
    const have = this.buf.get(clip.file); if (have) { go(have); return true; }
    fetch(this.base + clip.file).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))).then(b => c.decodeAudioData(b)).then(b => { this.buf.set(clip.file, b); go(b); }).catch(() => { /* a missing file: the synthesised voice already spoke or will next time */ }); return true;
  }
  stop() { if (this.playing) { try { this.playing.stop(); } catch (e) { /* ended */ } this.playing = null; } }
}
