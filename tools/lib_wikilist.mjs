// Parses the wikitext of en.wikipedia "List of Delhi Metro stations" into rows { station, line, opened, layout, platform, notes }.
// Wikipedia text is CC BY-SA; only the facts (names, dates, layout words) are read, no prose is copied.
const LINES = { Red: 'red', Yellow: 'yellow', Blue: 'blue', 'Blue Line Branch': 'blue', Branch: 'blue', Green: 'green', Violet: 'violet', Pink: 'pink', Magenta: 'magenta', Grey: 'grey', Gray: 'grey', Orange: 'airport', Airport: 'airport', 'Airport Express': 'airport' };
export function parseWikiList(wt) {
  const rows = []; let station = null, pending = 0;
  for (const chunk of wt.split(/\n\|-\s*\n?/)) {
    const cells = chunk.split('\n').filter(l => /^\s*[|!]/.test(l)).map(l => l.replace(/^\s*\|\s*/, '').replace(/^\s*!\s*/, ''));
    // a cell may start with attributes: `rowspan="2" align="center" |{{stl...}}`
    const vals = cells.map(c => { let s = c; const m = s.match(/^[^|{}\[]*?(?:align|rowspan|style|width|colspan)[^|{}\[]*\|(?!\|)(.*)$/s); if (m) s = m[1]; return s.trim(); });
    if (!vals.length) continue;
    const joined = vals.join('\n'); const stl = joined.match(/\{\{stl\|Delhi Metro\|([^}|]+)/);
    let i = 0; const lk = !stl && vals[0] && vals[0].match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (stl) { station = stl[1].trim(); i = vals.findIndex(v => /\{\{stl\|/.test(v)) + 1; }
    else if (lk) { station = (lk[2] || lk[1]).trim(); i = 1; }
    const lm = vals.slice(i).findIndex(v => /\{\{rcb\|Delhi Metro\|/.test(v)); if (lm < 0) continue; const k = i + lm;
    const lineName = vals[k].match(/\{\{rcb\|Delhi Metro\|([^|}]+)/)[1].trim();
    const opened = (vals[k + 1] || '').replace(/\[\[|\]\]|<ref.*$/g, '').trim(), layout = (vals[k + 2] || '').replace(/<ref.*$/g, '').trim(), platform = (vals[k + 3] || '').replace(/<ref.*$/g, '').trim();
    const fk = joined.match(/Formerly known as '''([^']+)'''/); rows.push({ station, line: lineName, opened, layout, platform, formerly: fk ? fk[1].trim() : null });
  }
  return rows;
}
