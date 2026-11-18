/* Hindi (Devanagari) for English street names, so every sign board can carry both scripts like the real NDMC boards.
   The pack has a Hindi name for only about 500 of 3,377 street names (from OpenStreetMap); the rest are made here: a dictionary of the words that fill Delhi's street names (Road, Marg, Nagar, Bagh, Chowk, ...) and, for any other word, a plain letter-by-letter transliteration. A name the pack already has in Hindi is always used instead (see hindiName). The result is a sign-board convenience, not an official spelling: tools/selftest.mjs checks only that it is Devanagari and never empty. */
const WORDS = {
  road: 'रोड', marg: 'मार्ग', lane: 'लेन', street: 'स्ट्रीट', nagar: 'नगर', bagh: 'बाग', chowk: 'चौक', gate: 'गेट', market: 'मार्केट', bazar: 'बाज़ार', bazaar: 'बाज़ार',
  place: 'प्लेस', circle: 'सर्कल', colony: 'कॉलोनी', park: 'पार्क', garden: 'गार्डन', enclave: 'एन्क्लेव', extension: 'एक्सटेंशन', vihar: 'विहार', puri: 'पुरी', pur: 'पुर',
  ring: 'रिंग', outer: 'आउटर', inner: 'इनर', link: 'लिंक', bypass: 'बाईपास', flyover: 'फ्लाईओवर', underpass: 'अंडरपास', highway: 'हाईवे', expressway: 'एक्सप्रेसवे', national: 'नेशनल',
  nehru: 'नेहरू', gandhi: 'गांधी', mahatma: 'महात्मा', jawaharlal: 'जवाहरलाल', indira: 'इंदिरा', rajiv: 'राजीव', rajendra: 'राजेंद्र', prasad: 'प्रसाद', sardar: 'सरदार', patel: 'पटेल',
  subhash: 'सुभाष', subhas: 'सुभाष', bose: 'बोस', tilak: 'तिलक', lala: 'लाला', lajpat: 'लाजपत', rai: 'राय', shivaji: 'शिवाजी', ambedkar: 'अंबेडकर', bhagat: 'भगत', singh: 'सिंह',
  new: 'न्यू', old: 'ओल्ड', delhi: 'दिल्ली', central: 'सेंट्रल', north: 'नॉर्थ', south: 'साउथ', east: 'ईस्ट', west: 'वेस्ट', main: 'मेन', station: 'स्टेशन', railway: 'रेलवे',
  airport: 'एयरपोर्ट', metro: 'मेट्रो', bus: 'बस', stand: 'स्टैंड', hospital: 'अस्पताल', school: 'स्कूल', university: 'विश्वविद्यालय', college: 'कॉलेज', temple: 'मंदिर', mandir: 'मंदिर',
  masjid: 'मस्जिद', gurudwara: 'गुरुद्वारा', church: 'चर्च', fort: 'किला', qila: 'किला', red: 'लाल', kila: 'किला', ganj: 'गंज', gunj: 'गंज', mandi: 'मंडी', sabzi: 'सब्ज़ी', block: 'ब्लॉक',
  sector: 'सेक्टर', phase: 'फेज़', pocket: 'पॉकेट', village: 'गाँव', gaon: 'गाँव', khan: 'खान', ali: 'अली', shah: 'शाह', kalan: 'कलां', khurd: 'खुर्द', sarai: 'सराय', kunj: 'कुंज', apartments: 'अपार्टमेंट्स',
  of: 'ऑफ़', the: 'द', and: 'और', to: 'टू', ke: 'के', ka: 'का', ki: 'की', and_: 'और', service: 'सर्विस', slip: 'स्लिप', approach: 'एप्रोच', entry: 'एंट्री', exit: 'एग्ज़िट'
};
const NUM = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
/* longest match first */
const DIG = [['ksh', 'क्ष'], ['chh', 'छ'], ['shr', 'श्र'], ['sh', 'श'], ['ch', 'च'], ['kh', 'ख'], ['gh', 'घ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['jh', 'झ'], ['ng', 'ंग'], ['ee', 'ी'], ['oo', 'ू'], ['aa', 'ा'], ['ai', 'ै'], ['au', 'ौ'], ['ou', 'ौ'], ['oa', 'ो']];
const CONS = { k: 'क', g: 'ग', c: 'क', j: 'ज', t: 'ट', d: 'ड', n: 'न', p: 'प', b: 'ब', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व', s: 'स', h: 'ह', f: 'फ', z: 'ज़', q: 'क', x: 'क्स' };
const VOW = { a: ['अ', ''], i: ['इ', 'ि'], u: ['उ', 'ु'], e: ['ए', 'े'], o: ['ओ', 'ो'] };
const MATRA = ['ी', 'ू', 'ा', 'ै', 'ौ', 'ो'];
/* letter-by-letter, the way Indian names are written: a consonant keeps its inherent 'a' unless a vowel follows; two consonants in a row are joined with a halant (an 'n' or 'm' before a consonant becomes the dot anusvara); a final 'a' is the long vowel (Kasturba -> कस्तूरबा style), a final 'i' or 'u' long too */
function translit(w) {
  const s = w.toLowerCase(), toks = []; let i = 0;
  while (i < s.length) {
    let hit = null; for (const [k, v] of DIG) if (s.startsWith(k, i)) { hit = [k, v]; break; }
    if (hit) { toks.push(MATRA.includes(hit[1]) ? { t: 'v', m: hit[1], ind: { 'ी': 'ई', 'ू': 'ऊ', 'ा': 'आ', 'ै': 'ऐ', 'ौ': 'औ', 'ो': 'ओ' }[hit[1]] } : { t: 'c', c: hit[1] }); i += hit[0].length; continue; }
    const ch = s[i]; i++;
    if (ch === 't') toks.push({ t: 'c', c: 'त' }); else if (ch === 'd') toks.push({ t: 'c', c: 'द' });
    else if (CONS[ch]) toks.push({ t: 'c', c: CONS[ch], n: ch === 'n' || ch === 'm' });
    else if (VOW[ch]) toks.push({ t: 'v', m: VOW[ch][1], ind: VOW[ch][0], a: ch === 'a' });
    else if (ch >= '0' && ch <= '9') toks.push({ t: 'x', c: NUM[+ch] });
  }
  let out = '', prev = null;
  toks.forEach((k, j) => {
    const last = j === toks.length - 1;
    if (k.t === 'c') { if (prev && prev.t === 'c') out += prev.n ? 'ं' : '्'; if (prev && prev.t === 'c' && prev.n) { out = out.slice(0, -2) + 'ं' ; } out += k.c; }
    else if (k.t === 'v') { if (prev && prev.t === 'c') { if (k.a) { if (last) out += 'ा'; } else out += (last && k.m === 'ि' ? 'ी' : last && k.m === 'ु' ? 'ू' : k.m); } else out += k.ind; }
    else out += k.c;
    prev = k;
  });
  return out;
}
const cache = new Map();
/* the Hindi for an English name: dictionary words first, other words by transliteration */
export function hindiOf(en) {
  if (!en) return '';
  if (cache.has(en)) return cache.get(en);
  const out = en.replace(/\(.*?\)/g, ' ').split(/[\s,/]+/).filter(Boolean).map(w => {
    const k = w.toLowerCase().replace(/[^a-z0-9]/g, ''); if (!k) return '';
    if (WORDS[k]) return WORDS[k]; if (/^\d+$/.test(k)) return [...k].map(d => NUM[+d]).join('');
    return translit(k);
  }).filter(Boolean).join(' ');
  if (cache.size > 4000) cache.clear(); cache.set(en, out); return out;
}
/* the pack's own Hindi name when it has one, else the made one */
export const hindiName = (nm) => nm && nm.hi ? nm.hi : hindiOf(nm && nm.en || '');
