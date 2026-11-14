/* The player's saved choices (localStorage 'gfp-next'): checked on load, so a damaged, old or hand-edited entry can never crash the game or put in a bad value.
   Pure (no DOM), so the self-test can throw rubbish at it. sanitiseSaved(raw, ctx) returns a plain object with only valid fields; anything wrong is dropped
   (the game then uses its default). ctx: { vehicles (how many), vehicleIds: ['car', ...], locations: ['default', ...] } */
const TIMES = ['dawn', 'day', 'dusk', 'night', 'auto'], WEATHER = ['clear', 'overcast', 'fog', 'rain', 'storm', 'snow', 'auto'], LIGHTS = ['auto', 'on', 'off'], CAMS = ['middle', 'far', 'close', 'hood', 'bumper', 'cockpit', 'cinematic'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function sanitiseSaved(raw, ctx = {}) {
  const out = { paint: {} }; if (!isObj(raw)) return out;                                       // always an object: the garage reads S.paint[id]
  if (TIMES.includes(raw.time)) out.time = raw.time;
  if (WEATHER.includes(raw.weather)) out.weather = raw.weather;
  if (LIGHTS.includes(raw.lights)) out.lights = raw.lights;
  if (Number.isInteger(raw.vehicle) && raw.vehicle >= 0 && raw.vehicle < (ctx.vehicles || 1)) out.vehicle = raw.vehicle;
  if (typeof raw.muted === 'boolean') out.muted = raw.muted;
  if (raw.rumble === 'on' || raw.rumble === 'off') out.rumble = raw.rumble;
  if (['off', 'low', 'mid', 'high'].includes(raw.traffic)) out.traffic = raw.traffic; else if (raw.traffic === 'light') out.traffic = 'low'; else if (raw.traffic === 'busy') out.traffic = 'high';          // 'light' and 'busy' were the first names
  if (typeof raw.radioVol === 'number' && Number.isFinite(raw.radioVol)) out.radioVol = Math.max(0, Math.min(1, raw.radioVol));
  if (typeof raw.station === 'string' && raw.station.length < 80) out.station = raw.station; else if (raw.station === null) out.station = null;
  if (CAMS.includes(raw.camBefore)) out.camBefore = raw.camBefore;
  if (typeof raw.location === 'string' && (!ctx.locations || ctx.locations.includes(raw.location))) out.location = raw.location;
  if (isObj(raw.paint)) for (const [id, c] of Object.entries(raw.paint)) if ((!ctx.vehicleIds || ctx.vehicleIds.includes(id)) && typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) out.paint[id] = c;
  return out;
}
