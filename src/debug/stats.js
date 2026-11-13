/* On-screen stats panel: frame rate and the counters that reveal leaks and slowdowns. `lines()` returns extra rows. */
export function statsPanel(el, renderer, lines) {
  let frames = 0, last = performance.now(), fps = 0, worst = 0, prev = last;
  return function tick(now) {
    frames++; worst = Math.max(worst, now - prev); prev = now; if (now - last < 500) return;
    fps = frames * 1000 / (now - last); const i = renderer.info;
    el.textContent = [
      'fps         ' + fps.toFixed(0) + '   (worst frame ' + worst.toFixed(0) + ' ms)',
      'draw calls  ' + i.render.calls, 'triangles   ' + i.render.triangles.toLocaleString('en-US'),
      'geometries  ' + i.memory.geometries, 'textures    ' + i.memory.textures, ...lines()
    ].join('\n');
    frames = 0; last = now; worst = 0;
  };
}
