/* A junction where several roads cross (docs/INDIA_MAP_PLAN.md section 9): the cars of each road's own simulation obey one shared signal and some of them turn onto another road. Pure (no three.js).
   Each arm is one road through the junction: { sim (that road's TrafficSim), road, s (the junction's distance along it), phase }. Arms take turns: the roads are shared out over at most three
   phases (so a star of five roads waits at most about 40 s), each phase is green for GREEN s, amber for AMBER s, then all red for CLEAR s before the next. The clock is advanced by the owner
   (Traffic.update). A car that reaches the junction centre may turn: it is handed from its sim to another arm's sim (a short blend of position and heading hides the jump). */
export const JSIG = { green: 14, amber: 3, clear: 2 };
let nextNum = 1;
export class Junction {
  constructor(x, z) { this.num = nextNum++; this.x = x; this.z = z; this.arms = []; this.clock = 0; this.turns = 0; }
  addArm(sim, road, s) { const arm = { k: this.arms.length, sim, road, s, phase: 0 }; this.arms.push(arm); const n = this.phases; this.arms.forEach((a, i) => { a.phase = i % n; }); return arm; }
  get phases() { return Math.max(1, Math.min(3, this.arms.length)); }
  get cycle() { return this.phases * (JSIG.green + JSIG.amber + JSIG.clear); }
  /* 'green', 'amber' or 'red' for an arm at a time (default: now) */
  state(arm, time = this.clock) {
    if (this.arms.length < 2) return 'green'; const slot = JSIG.green + JSIG.amber + JSIG.clear, t = ((time % this.cycle) + this.cycle) % this.cycle, idx = Math.floor(t / slot), within = t - idx * slot;
    if (idx !== arm.phase) return 'red'; return within < JSIG.green ? 'green' : within < JSIG.green + JSIG.amber ? 'amber' : 'red';
  }
  /* hand car c (from the arm `from`) to the arm `to`: false if there is no room or no road that way. rnd: a function returning numbers in [0, 1) */
  transfer(c, from, to, rnd) {
    const sim = to.sim, R = to.road; if (!sim.cap || sim.cars.length >= sim.cap) return false;
    const room = [R.sMax - to.s > 150 ? 1 : 0, to.s - R.sMin > 150 ? -1 : 0].filter(x => x !== 0); if (!room.length) return false; const dir = room[Math.floor(rnd() * room.length)], lane = Math.floor(rnd() * sim.lanes.length), s = to.s + dir * (8 + c.len / 2);
    for (const o of sim.cars) if (o.dir === dir && o.lane === lane && Math.abs(o.s - s) < 18) return false;
    const got = sim.pool.acquire(); if (!got) return false; const car = got.obj;
    Object.assign(car, { handle: got.handle, id: sim.nextId++, s, dir, lane, kind: c.kind, len: c.len, w: c.w, h: c.h, v0: sim.limit * (0.7 + rnd() * 0.28) * (c.len > 6.5 ? 0.8 : 1), speed: Math.max(4, c.speed * 0.7), colour: c.colour, lat: sim.lateral(dir, lane), off: 0, chg: 0, stuck: 0, bump: 0, born: sim.time, bornDist: 0, brake: 0, turnJ: this.num, fx: c.x, fz: c.z, fyaw: c.yaw, blend: 1 });
    sim.place(car); sim.cars.push(car); this.turns++; return true;
  }
}
