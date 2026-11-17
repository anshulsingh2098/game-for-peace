/* Game for Peace Tracker: a small Cloudflare Worker that serves tracker/public (the page) and keeps its shared state in KV.
   GET /api/tracker returns { items, custom }; PUT /api/tracker merges { items, custom, delItems, delCustom } (an item with a newer `at` wins).
   Every call needs the shared password in the x-tracker-key header (the Worker secret TRACKER_PASSWORD, never in the repo). Separate from the game's own Worker: deploy it on its own. */
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ID = /^[A-Za-z0-9_-]{1,64}$/, MAX_BODY = 256 * 1024, MAX_DOCS = 3000;

/* constant-time comparison of two strings */
function same(a, b) { const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b); let d = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0); return d === 0; }
const clean = (m, now) => { const out = {}; if (!m || typeof m !== 'object') return out; for (const id of Object.keys(m)) { if (!ID.test(id) || !m[id] || typeof m[id] !== 'object' || Array.isArray(m[id])) continue; const v = m[id]; out[id] = { ...v, at: Math.min(+v.at || now, now + 60000) }; } return out; };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/tracker') { const r = await env.ASSETS.fetch(request); const h = new Headers(r.headers); h.set('x-robots-tag', 'noindex, nofollow'); return new Response(r.body, { status: r.status, headers: h }); }
    if (!env.TRACKER_PASSWORD || !env.TRACKER) return json({ error: 'not configured' }, 503);
    if (!same(request.headers.get('x-tracker-key') || '', env.TRACKER_PASSWORD)) { await sleep(400); return json({ error: 'unauthorized' }, 401); }
    const cur = (await env.TRACKER.get('data', 'json')) || { items: {}, custom: {} };
    if (request.method === 'GET') return json({ items: cur.items || {}, custom: cur.custom || {} });
    if (request.method !== 'PUT') return json({ error: 'method not allowed' }, 405);
    const len = +request.headers.get('content-length') || 0; if (len > MAX_BODY) return json({ error: 'too large' }, 413);
    const text = await request.text(); if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
    let body; try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad body' }, 400);
    const now = Date.now(), items = { ...(cur.items || {}) }, custom = { ...(cur.custom || {}) };
    for (const [id, v] of Object.entries(clean(body.items, now))) if (!items[id] || v.at >= (items[id].at || 0)) items[id] = v;
    for (const [id, v] of Object.entries(clean(body.custom, now))) if (!custom[id] || v.at >= (custom[id].at || 0)) custom[id] = v;
    for (const id of Array.isArray(body.delItems) ? body.delItems : []) if (ID.test(id)) delete items[id];
    for (const id of Array.isArray(body.delCustom) ? body.delCustom : []) if (ID.test(id)) delete custom[id];
    if (Object.keys(items).length + Object.keys(custom).length > MAX_DOCS) return json({ error: 'too many items' }, 413);
    await env.TRACKER.put('data', JSON.stringify({ items, custom }));
    return json({ ok: true });
  },
};
