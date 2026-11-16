/* The saved game (N15): one versioned record in localStorage ('gfp-next'), with recovery from damage and a migration path.
   Shape (version 2): the player's settings as flat fields (see saved.js), plus  v: 2  and  progress: { activities: { id: { plays, best?, rating? } } }.
   Version 1 (and records with no version) were the flat settings only: they migrate by gaining empty progress. A record from a NEWER build is read as far as this build understands it
   and is never written over (readOnly), so going back to an old build cannot destroy newer progress. Text that is not JSON, or not an object, is kept under 'gfp-next.bad' (one copy,
   for support) and the game starts from defaults. Pure (storage is passed in), so the self-test runs it with a fake. */
import { sanitiseSaved } from './saved.js';
export const SAVE_VERSION = 2, SAVE_KEY = 'gfp-next', BAD_KEY = 'gfp-next.bad';

/* parse stored text; status: 'empty' | 'ok' | 'migrated' | 'newer' | 'corrupt' */
export function parseSave(text) {
  if (text === null || text === undefined || text === '') return { status: 'empty', raw: {} };
  let raw; try { raw = JSON.parse(text); } catch (e) { return { status: 'corrupt', raw: {} }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'corrupt', raw: {} };
  const v = Number.isInteger(raw.v) ? raw.v : 1; if (v > SAVE_VERSION) return { status: 'newer', raw, from: v }; return { status: v < SAVE_VERSION ? 'migrated' : 'ok', raw, from: v };
}

/* read, check and (if needed) migrate; never throws. Returns { data (clean fields), status, readOnly } */
export function loadSave(storage, ctx = {}) {
  let text = null; try { text = storage.getItem(SAVE_KEY); } catch (e) { /* storage unavailable: play without saving */ }
  const r = parseSave(text);
  if (r.status === 'corrupt') { try { storage.setItem(BAD_KEY, String(text).slice(0, 20000)); storage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  return { data: sanitiseSaved(r.raw, ctx), status: r.status, readOnly: r.status === 'newer' };
}

/* write the settings and progress; refuses (returns false) when the stored record is from a newer build or storage is unavailable */
export function writeSave(storage, state, load) {
  if (load && load.readOnly) return false;
  try { storage.setItem(SAVE_KEY, JSON.stringify({ ...state, v: SAVE_VERSION })); return true; } catch (e) { return false; }
}
