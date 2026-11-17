/* The Game for Peace worker: serves the static site, plus a tiny settings API for the tuner dashboard (tuner.html).
     GET  /api/settings   the published settings { version, overrides, updated }; open to everyone (the game reads it at start)
     PUT  /api/settings   publish new settings; needs the password          (Authorization: Bearer <TUNER_PASSWORD>)
     GET  /api/history    the last published versions; needs the password
   Settings live in a KV namespace bound as SETTINGS; the password is a secret named TUNER_PASSWORD. Both are set up once
   (see team/stream-a.md). Without them the API answers 503 and the site works as before. Everything else goes to the static files. */
const MAX_BYTES = 64 * 1024, MAX_SETTINGS = 2000, HISTORY = 15, MAX_ABS = 1e7;            // MAX_ABS: no setting is ever a bigger number than this (they are metres, kilograms, seconds, 0..1 mixes)
const reply = (body, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache, 'x-content-type-options': 'nosniff' } });

export function validate(body) {
  if (!body || typeof body !== 'object' || !body.overrides || typeof body.overrides !== 'object' || Array.isArray(body.overrides)) return 'overrides must be an object';
  const e = Object.entries(body.overrides); if (e.length > MAX_SETTINGS) return 'too many settings';
  for (const [k, v] of e) {
    if (!/^[A-Za-z0-9_.-]{1,120}$/.test(k)) return 'bad setting path: ' + k.slice(0, 40);
    if (!(typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_ABS) && !(typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))) return 'bad value for ' + k;
  }
  return null;
}

/* compare two strings without stopping at the first difference */
async function sameSecret(a, b) {
  const enc = new TextEncoder(), [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x), q = new Uint8Array(y); let d = 0; for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i]; return d === 0;
}
async function authorised(request, env) {
  if (!env.TUNER_PASSWORD) return 'not-set-up';
  const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '');
  return m && await sameSecret(m[1], env.TUNER_PASSWORD) ? 'yes' : 'no';
}

export async function handleApi(request, env, url) {
  if (!env.SETTINGS) return reply({ error: 'settings storage is not set up' }, 503);
  if (url.pathname === '/api/settings' && request.method === 'GET') {
    const cur = await env.SETTINGS.get('current', 'json');
    return reply(cur || { version: 1, overrides: {}, updated: null }, 200, 'public, max-age=20');
  }
  const auth = await authorised(request, env);
  if (auth === 'not-set-up') return reply({ error: 'password is not set up' }, 503);
  if (auth !== 'yes') { await new Promise(r => setTimeout(r, +(env.AUTH_DELAY_MS ?? 400))); return reply({ error: 'wrong password' }, 401); }          // a short wait on every wrong guess makes guessing the password slow
  if (url.pathname === '/api/settings' && request.method === 'PUT') {
    if (+request.headers.get('content-length') > MAX_BYTES) return reply({ error: 'too large' }, 413);                        // refuse before reading a huge body
    const text = await request.text(); if (text.length > MAX_BYTES) return reply({ error: 'too large' }, 413);
    let body; try { body = JSON.parse(text); } catch (e) { return reply({ error: 'not JSON' }, 400); }
    const bad = validate(body); if (bad) return reply({ error: bad }, 400);
    const cur = { version: 1, overrides: body.overrides, updated: new Date().toISOString() };
    const hist = (await env.SETTINGS.get('history', 'json')) || []; hist.unshift({ ...cur, note: typeof body.note === 'string' ? body.note.slice(0, 80) : '' });
    await env.SETTINGS.put('history', JSON.stringify(hist.slice(0, HISTORY))); await env.SETTINGS.put('current', JSON.stringify(cur));
    return reply({ ok: true, updated: cur.updated, count: Object.keys(cur.overrides).length });
  }
  if (url.pathname === '/api/history' && request.method === 'GET') return reply({ history: (await env.SETTINGS.get('history', 'json')) || [] });
  return reply({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
