/* Seeded random numbers: the Alea generator (Johannes Baagoe's algorithm).
   Same seed, same sequence, on every device. Use extra labels to get independent streams from one seed:
   alea(seed, 'trees') and alea(seed, 'rocks') never line up. */
function mash() {
  let n = 0xefc8249d;
  return data => {
    data = String(data);
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0; h -= n; h *= n;
      n = h >>> 0; h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  };
}

export function alea(...seeds) {
  const m = mash();
  let s0 = m(' '), s1 = m(' '), s2 = m(' '), c = 1;
  for (const s of seeds) {
    s0 -= m(s); if (s0 < 0) s0 += 1;
    s1 -= m(s); if (s1 < 0) s1 += 1;
    s2 -= m(s); if (s2 < 0) s2 += 1;
  }
  const next = () => { const t = 2091639 * s0 + c * 2.3283064365386963e-10; s0 = s1; s1 = s2; return s2 = t - (c = t | 0); };
  next.range = (a, b) => a + next() * (b - a);
  next.int = n => Math.floor(next() * n);
  next.uint32 = () => next() * 0x100000000 >>> 0;
  return next;
}

/* A short random seed word for "new world" buttons. Not seeded on purpose. */
export function randomSeed() {
  const a = 'bcdfghjklmnprstvwz', b = 'aeiou'; let s = '';
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
  return s;
}
