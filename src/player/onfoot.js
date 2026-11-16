/* On-foot player (N14): a kinematic character controller on the same ground and obstacles the vehicle uses, plus the pieces around it: a safe place to step out of a vehicle and the
   interaction registry (one contract for "something you can use": prompt, range, action). Pure JavaScript, so the self-test runs it headless.
   World interface (the same object the vehicle physics gets): height(x, z), near(x, z, r) -> lists of circles { x, z, r }, seaLevel.
   Movement: the character turns with `steer`, walks forward with `throttle` and back with `rev` (walk speed, run with `run`), jumps on `jump`. It stays on the ground (the road surface,
   bridge decks included), climbs steps up to maxStep, will not climb a slope steeper than maxSlope or wade into water deeper than wade, slides along obstacle circles (buildings,
   trees, rails, cars) and cannot stand inside one. Walking is smooth on the same floating-origin world: positions are world metres. */
export const FOOT = { walk: 1.7, run: 4.8, back: 1.1, turn: 2.4, radius: 0.35, jump: 4.6, gravity: 16, maxStep: 0.55, maxSlope: 1.0, wade: 0.5, accel: 14 };

export class OnFoot {
  constructor(world) { this.world = world; this.x = 0; this.z = 0; this.y = 0; this.yaw = 0; this.vy = 0; this.speed = 0; this.grounded = true; this.phase = 0; this.moving = false; this.jumpHeld = false; }
  place(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.y = this.world.height(x, z); this.vy = 0; this.speed = 0; this.grounded = true; }
  /* one step of dt seconds; input: { steer, throttle, rev, run, jump } */
  step(dt, input) {
    const W = this.world, F = FOOT; this.yaw += (input.steer || 0) * F.turn * dt; const fwd = (input.throttle || 0) - (input.rev || 0);
    const target = fwd > 0 ? (input.run ? F.run : F.walk) * Math.min(1, fwd) : fwd < 0 ? -F.back * Math.min(1, -fwd) : 0;
    const k = Math.min(1, F.accel * dt); this.speed += (target - this.speed) * k; if (Math.abs(this.speed) < 0.02 && target === 0) this.speed = 0;
    const dx = Math.cos(this.yaw) * this.speed * dt, dz = Math.sin(this.yaw) * this.speed * dt;
    if (dx !== 0 || dz !== 0) { const px = this.x, pz = this.z; if (!this.tryMove(this.x + dx, this.z + dz)) { if (this.hit) { const nxv = this.x - this.hit.x, nzv = this.z - this.hit.z, d = Math.hypot(nxv, nzv) || 1, vn = (dx * nxv + dz * nzv) / d; this.tryMove(this.x + dx - vn * nxv / d, this.z + dz - vn * nzv / d); } else if (!this.tryMove(this.x + dx, this.z)) this.tryMove(this.x, this.z + dz); } this.moving = Math.hypot(this.x - px, this.z - pz) > 1e-4; } else this.moving = false;
    this.pushOut(); this.phase += Math.abs(this.speed) * dt * 2.2;
    const g = W.height(this.x, this.z);
    if (input.jump && !this.jumpHeld && this.grounded) { this.vy = F.jump; this.grounded = false; } this.jumpHeld = !!input.jump;
    if (!this.grounded) { this.vy -= F.gravity * dt; this.y += this.vy * dt; if (this.y <= g) { this.y = g; this.vy = 0; this.grounded = true; } }
    else if (this.y - g > F.maxStep) { this.grounded = false; this.vy = 0; }                                // walked off a ledge: fall
    else this.y = g;
    return this;
  }
  /* try to stand at (nx, nz): refused if it is too steep, a step too high, or deep water */
  tryMove(nx, nz) {
    this.hit = null;
    const W = this.world, F = FOOT, h = W.height(nx, nz), cur = this.grounded ? W.height(this.x, this.z) : this.y; if (h - cur > F.maxStep && this.grounded) return false;
    const run = Math.hypot(nx - this.x, nz - this.z); if (run > 1e-6 && this.grounded) { const px = nx + (nx - this.x) / run * 0.5, pz = nz + (nz - this.z) / run * 0.5; if ((W.height(px, pz) - h) / 0.5 > F.maxSlope && W.height(px, pz) > h + 0.12) return false; }          // too steep: judged over the next half metre, so a kerb is a step but a cliff face is not
    if (h < W.seaLevel - F.wade && (this.grounded || this.y < W.seaLevel)) return false;
    for (const l of W.near(nx, nz, F.radius + 4)) for (const c of l) if (Math.hypot(nx - c.x, nz - c.z) < c.r + F.radius - 0.15 && Math.hypot(this.x - c.x, this.z - c.z) > Math.hypot(nx - c.x, nz - c.z)) { this.hit = c; return false; }     // moving deeper into an obstacle
    this.x = nx; this.z = nz; return true;
  }
  /* if something pushed us into an obstacle (a car drove up), move out along the shortest way */
  pushOut() { const W = this.world, F = FOOT; for (const l of W.near(this.x, this.z, F.radius + 4)) for (const c of l) { const d = Math.hypot(this.x - c.x, this.z - c.z), m = c.r + F.radius - 0.15; if (d < m && d > 1e-6) { this.x = c.x + (this.x - c.x) / d * m; this.z = c.z + (this.z - c.z) / d * m; } } }
}

/* where to put the character when they step out: just beside the driver's door (left, then right, then behind), on dry level ground clear of obstacles; null if nowhere is free.
   car: { x, z, yaw, halfWidth, halfLength } (yaw: the direction the car faces, as phys.yaw; left of it is the side with the driver in a left-hand-drive car). */
export function chooseExit(car, world, tries = [1, -1]) {
  const f = [Math.cos(car.yaw), Math.sin(car.yaw)], l = [-f[1], f[0]], out = (car.halfWidth || 1) + 0.9;
  const spots = []; for (const side of tries) spots.push([car.x + l[0] * out * side, car.z + l[1] * out * side]); spots.push([car.x - f[0] * ((car.halfLength || 2.2) + 1.2), car.z - f[1] * ((car.halfLength || 2.2) + 1.2)]);
  for (const [x, z] of spots) {
    const h = world.height(x, z); if (h < world.seaLevel - FOOT.wade) continue; if (Math.abs(h - world.height(car.x, car.z)) > FOOT.maxStep * 2.5) continue; let free = true;
    for (const lst of world.near(x, z, FOOT.radius + 4)) for (const c of lst) if (!c.traffic && Math.hypot(x - c.x, z - c.z) < c.r + FOOT.radius + 0.1) free = false; if (free) return { x, z, yaw: car.yaw };
  } return null;
}

/* the interaction contract: anything you can use registers { id, x, z, r, prompt, onUse, enabled }; the nearest one in range supplies the prompt and runs when used */
export class Interactions {
  constructor() { this.items = new Map(); }
  add(item) { if (!item || !item.id) throw new Error('an interactable needs an id'); this.items.set(item.id, { r: 3, enabled: () => true, ...item }); return () => this.items.delete(item.id); }
  remove(id) { return this.items.delete(id); }
  nearest(x, z, prefix = '') { let best = null, bd = Infinity; for (const it of this.items.values()) { if (!it.enabled() || !it.id.startsWith(prefix)) continue; const d = Math.hypot(x - it.x, z - it.z); if (d <= it.r && d < bd) { bd = d; best = it; } } return best; }
  use(x, z, prefix = '') { const it = this.nearest(x, z, prefix); if (!it) return false; it.onUse(it); return true; }
}
