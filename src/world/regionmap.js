/* Which region a place belongs to (N8, docs/INDIA_MAP_PLAN.md section 9): the nearest region by the real place each one is an impression of (its `inspiration` latitude and longitude), with a
   blend weight near the border with the second nearest, so the look of the land can change gradually between regions when the world is one continuous map. Pure (no three.js).
   regionAt(lat, lon, regions) -> { id, second, blend (0 = fully in `id`, 0.5 = on the border), km (distance to the region's place) } or null for an empty list. */
const RAD = Math.PI / 180;
export function distKm(lat1, lon1, lat2, lon2) { const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(a))); }
export function regionAt(lat, lon, regions) {
  let a = null, b = null; for (const r of regions) { const d = distKm(lat, lon, r.inspiration.lat, r.inspiration.lon); if (!a || d < a.d) { b = a; a = { id: r.id, d }; } else if (!b || d < b.d) b = { id: r.id, d }; }
  if (!a) return null; if (!b) return { id: a.id, second: null, blend: 0, km: a.d };
  const blend = Math.max(0, 0.5 - (b.d - a.d) / (2 * 150));                                  // within 150 km of the equal-distance line the two regions mix, 0.5 exactly on it
  return { id: a.id, second: b.id, blend, km: a.d };
}
