/* Tile mesh data: fills position, normal, colour and uv arrays for one square terrain tile.
   Pure maths, no three.js, so it can be tested in Node and moved to a worker later.
   Layout: a (res+1) x (res+1) grid of vertices, row by row, followed by four "skirt" strips: copies of the
   edge vertices pushed down, which hide the cracks where a fine tile meets a coarse one. */
export const vertexCount = res => (res + 1) * (res + 1) + 4 * (res + 1);
export const skirtDepth = (size, res) => size / res * 2 + 4;

const scratch = new Map(), rgb = [0, 0, 0];

export function fillTile(terrain, x0, z0, size, res, pos, nor, col, uv) {
  const n = res + 1, cell = size / res, m = n + 2;
  let H = scratch.get(res); if (!H) { H = new Float32Array(m * m); scratch.set(res, H); }
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) H[(j + 1) * m + i + 1] = terrain.height(x0 + i * cell, z0 + j * cell);   // one extra ring so edge normals match the neighbour tile
  const uvk = Math.max(1, Math.round(size * 0.11)) / size;      // whole number of texture repeats per tile, so tiles join without a seam
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, c = (j + 1) * m + i + 1, h = H[c];
    let nx = H[c - 1] - H[c + 1], ny = 2 * cell, nz = H[c - m] - H[c + m]; const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv; nz *= inv;
    pos[k * 3] = i * cell; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * cell;
    nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
    terrain.colour(x0 + i * cell, z0 + j * cell, h, ny, rgb); col[k * 3] = rgb[0]; col[k * 3 + 1] = rgb[1]; col[k * 3 + 2] = rgb[2];
    uv[k * 2] = i * cell * uvk; uv[k * 2 + 1] = j * cell * uvk;
    if (h < minY) minY = h; if (h > maxY) maxY = h;
  }
  const drop = skirtDepth(size, res); let s = n * n;
  const copy = k => {
    pos[s * 3] = pos[k * 3]; pos[s * 3 + 1] = pos[k * 3 + 1] - drop; pos[s * 3 + 2] = pos[k * 3 + 2];
    nor[s * 3] = nor[k * 3]; nor[s * 3 + 1] = nor[k * 3 + 1]; nor[s * 3 + 2] = nor[k * 3 + 2];
    col[s * 3] = col[k * 3]; col[s * 3 + 1] = col[k * 3 + 1]; col[s * 3 + 2] = col[k * 3 + 2];
    uv[s * 2] = uv[k * 2]; uv[s * 2 + 1] = uv[k * 2 + 1]; s++;
  };
  for (let q = 0; q < n; q++) copy(edgeVertex(0, q, n));
  for (let q = 0; q < n; q++) copy(edgeVertex(1, q, n));
  for (let q = 0; q < n; q++) copy(edgeVertex(2, q, n));
  for (let q = 0; q < n; q++) copy(edgeVertex(3, q, n));
  return { minY: minY - drop, maxY };
}

/* grid vertex number of the q-th vertex along edge e (0 = near row, 1 = far row, 2 = left column, 3 = right column) */
function edgeVertex(e, q, n) { return e === 0 ? q : e === 1 ? (n - 1) * n + q : e === 2 ? q * n : q * n + n - 1; }

/* triangle list for a tile of this resolution; every tile of the same resolution shares it */
export function tileIndex(res) {
  const n = res + 1, idx = [];
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const base = n * n;
  for (let e = 0; e < 4; e++) for (let q = 0; q < res; q++) {
    const a = edgeVertex(e, q, n), b = edgeVertex(e, q + 1, n), sa = base + e * n + q, sb = sa + 1;
    idx.push(a, b, sa, b, sb, sa, a, sa, b, b, sa, sb);        // both windings: a skirt is seen from either side
  }
  return new Uint16Array(idx);
}
