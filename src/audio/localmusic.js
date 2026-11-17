/* "My music": the player's own songs, played from their own device. Files never leave the browser (no upload, nothing is added to the site).
   Pure helpers (no DOM), so the self-test can check them; the radio (radio.js) and the radio wheel (ui/radiowheel.js) use them. */
export const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i;
export const MAX_BYTES = 80 * 1024 * 1024, MAX_TRACKS = 200;

/* a file name as a song title: drop the extension, leading track numbers and "(official video)" style tags */
export function cleanName(name) {
  let t = String(name).replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/[_]+/g, ' ').replace(/^\d{1,3}[\s.\-_)]+/, '').replace(/\s*[(\[](official|lyrics?|audio|video|hd|hq|music video)[^)\]]*[)\]]/ig, '').replace(/\s+/g, ' ').trim();
  return t || String(name);
}

/* sort a list of picked files ({ name, type, size }) into the ones to play and the ones left out, with a plain-words reason for each. `have` is how many songs are already loaded. */
export function classify(files, have = 0) {
  const ok = [], skipped = [];
  for (const f of files) {
    if (!f || !f.name) continue;
    if (!((f.type && f.type.startsWith('audio/')) || AUDIO_EXT.test(f.name))) skipped.push({ name: f.name, reason: 'not an audio file' });
    else if (!(f.size > 0)) skipped.push({ name: f.name, reason: 'empty file' });
    else if (f.size > MAX_BYTES) skipped.push({ name: f.name, reason: 'too big (over ' + MAX_BYTES / 1048576 + ' MB)' });
    else if (have + ok.length >= MAX_TRACKS) skipped.push({ name: f.name, reason: 'too many songs (limit ' + MAX_TRACKS + ')' });
    else ok.push(f);
  }
  return { ok, skipped };
}
