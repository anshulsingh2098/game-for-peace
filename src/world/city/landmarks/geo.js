/* Small plan geometry for the landmark builders (no three.js): rays against a polygon and a frame that places things along a chosen axis. Local metres, x then z. */
/* the nearest hit of the ray from (ox, oz) along (dx, dz) with the closed polygon: { x, z, t, ex, ez (unit direction of the edge hit) } or null */
export function rayPoly(poly, ox, oz, dx, dz) {
  let best = null; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - ox) * ez - (a[1] - oz) * ex) / den, u = ((a[0] - ox) * dz - (a[1] - oz) * dx) / den; if (t > 1e-3 && u >= 0 && u <= 1 && (!best || t < best.t)) { const L = Math.hypot(ex, ez) || 1; best = { x: ox + dx * t, z: oz + dz * t, t, ex: ex / L, ez: ez / L }; } }
  return best;
}
/* a frame at (ox, oz) whose u axis points along angle `ang` (radians in the local x-z plane): loc(u, v) -> [x, z]; box/arch turns for the kit: ryBox turns a box so its length runs along u, ryArch turns an arch block so its opening passes along u */
export function frame(ox, oz, ang) { const c = Math.cos(ang), s = Math.sin(ang); return { loc: (u, v) => [ox + u * c - v * s, oz + u * s + v * c], ang, ryBox: -ang, ryArch: Math.PI / 2 - ang, c, s }; }
