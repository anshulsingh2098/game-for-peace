/* Big binary files (the India terrain grid is 3.3 MB) are not compressed by the host, so they are kept next to a gzip copy (name + '.gz', about 40% of the size) and this loads the small one.
   fetchGrid(url): the .gz copy if it is there (unpacked in the browser with DecompressionStream, or used as it is when the host already unpacked it), else the plain file. Returns an ArrayBuffer. */
export const isGzip = u8 => u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b;
export async function fetchGrid(url, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  try {
    if (typeof DecompressionStream === 'function') {
      const r = await fetchImpl(url + '.gz');
      if (r && r.ok) { const raw = await r.arrayBuffer(), u8 = new Uint8Array(raw);
        if (!isGzip(u8)) return raw;                                                          // the host already unpacked it
        return await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }
    }
  } catch (e) { /* fall through to the plain file */ }
  const r = await fetchImpl(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer();
}
