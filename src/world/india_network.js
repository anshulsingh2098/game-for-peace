/* India as a network (docs/INDIA_MAP_PLAN.md): cities, the national highways and the railway trunk routes as ordered lists of city ids. Pure data and small helpers (no three.js, no DOM),
   so the self-test checks it and india_map.html draws it. Positions are latitude and longitude to about 0.1 degree, entered by hand (facts, not traced from any map); the corridor
   lists come from public descriptions of the Golden Quadrilateral, the North-South and East-West Corridors and the Indian Railways Golden Quadrilateral and Golden Diagonal. They are a
   SCHEMATIC of which cities each road or line joins, not surveyed alignments: highway numbers and the intermediate cities are approximate and must be checked against NHAI and Railways
   tables before they are shown to players as fact. No OpenStreetMap or map-derived data is used (the ODbL decision is the owner's, docs/REGIONS.md).
   City fields: [id, name, lat, lon, tier ('metro' | 'major' | 'city' | 'town'), state, tags]. */
const C = (id, name, lat, lon, tier, state, tags = '') => ({ id, name, lat, lon, tier, state, tags: tags ? tags.split(' ') : [] });
export const CITIES = [
  C('delhi', 'Delhi', 28.61, 77.21, 'metro', 'Delhi', 'capital airport'), C('mumbai', 'Mumbai', 19.08, 72.88, 'metro', 'Maharashtra', 'port airport'), C('kolkata', 'Kolkata', 22.57, 88.36, 'metro', 'West Bengal', 'port airport'),
  C('chennai', 'Chennai', 13.08, 80.27, 'metro', 'Tamil Nadu', 'port airport'), C('bengaluru', 'Bengaluru', 12.97, 77.59, 'metro', 'Karnataka', 'airport'), C('hyderabad', 'Hyderabad', 17.39, 78.49, 'metro', 'Telangana', 'airport'),
  C('ahmedabad', 'Ahmedabad', 23.02, 72.57, 'major', 'Gujarat', 'airport'), C('pune', 'Pune', 18.52, 73.86, 'major', 'Maharashtra', 'airport'), C('jaipur', 'Jaipur', 26.91, 75.79, 'major', 'Rajasthan', 'airport'),
  C('lucknow', 'Lucknow', 26.85, 80.95, 'major', 'Uttar Pradesh', 'capital'), C('kanpur', 'Kanpur', 26.45, 80.33, 'major', 'Uttar Pradesh'), C('nagpur', 'Nagpur', 21.15, 79.09, 'major', 'Maharashtra', 'junction'),
  C('bhopal', 'Bhopal', 23.26, 77.41, 'major', 'Madhya Pradesh', 'capital'), C('patna', 'Patna', 25.59, 85.14, 'major', 'Bihar', 'capital'), C('agra', 'Agra', 27.18, 78.01, 'city', 'Uttar Pradesh', 'heritage'),
  C('varanasi', 'Varanasi', 25.32, 83.01, 'city', 'Uttar Pradesh', 'pilgrimage'), C('prayagraj', 'Prayagraj', 25.44, 81.85, 'city', 'Uttar Pradesh', 'pilgrimage'), C('amritsar', 'Amritsar', 31.63, 74.87, 'city', 'Punjab', 'pilgrimage airport'),
  C('srinagar', 'Srinagar', 34.08, 74.80, 'major', 'Jammu and Kashmir', 'hill airport'), C('jammu', 'Jammu', 32.73, 74.86, 'city', 'Jammu and Kashmir'), C('pathankot', 'Pathankot', 32.27, 75.65, 'town', 'Punjab'),
  C('jalandhar', 'Jalandhar', 31.33, 75.58, 'city', 'Punjab'), C('ambala', 'Ambala', 30.38, 76.78, 'town', 'Haryana', 'junction'), C('chandigarh', 'Chandigarh', 30.73, 76.78, 'major', 'Chandigarh', 'capital'),
  C('gwalior', 'Gwalior', 26.22, 78.18, 'city', 'Madhya Pradesh', 'heritage'), C('jhansi', 'Jhansi', 25.45, 78.57, 'city', 'Uttar Pradesh', 'junction'), C('sagar', 'Sagar', 23.84, 78.74, 'town', 'Madhya Pradesh'),
  C('lakhnadon', 'Lakhnadon', 22.60, 79.60, 'town', 'Madhya Pradesh'), C('adilabad', 'Adilabad', 19.67, 78.53, 'town', 'Telangana'), C('nizamabad', 'Nizamabad', 18.67, 78.09, 'town', 'Telangana'),
  C('kurnool', 'Kurnool', 15.83, 78.04, 'city', 'Andhra Pradesh'), C('anantapur', 'Anantapur', 14.68, 77.60, 'town', 'Andhra Pradesh'), C('krishnagiri', 'Krishnagiri', 12.52, 78.21, 'town', 'Tamil Nadu'),
  C('salem', 'Salem', 11.66, 78.15, 'city', 'Tamil Nadu'), C('madurai', 'Madurai', 9.93, 78.12, 'city', 'Tamil Nadu', 'pilgrimage'), C('tirunelveli', 'Tirunelveli', 8.73, 77.70, 'town', 'Tamil Nadu'),
  C('kanyakumari', 'Kanyakumari', 8.08, 77.54, 'town', 'Tamil Nadu', 'pilgrimage coast'), C('udaipur', 'Udaipur', 24.58, 73.68, 'city', 'Rajasthan', 'heritage'), C('ajmer', 'Ajmer', 26.45, 74.64, 'city', 'Rajasthan', 'pilgrimage'),
  C('vadodara', 'Vadodara', 22.31, 73.18, 'city', 'Gujarat'), C('surat', 'Surat', 21.17, 72.83, 'major', 'Gujarat', 'port'), C('kolhapur', 'Kolhapur', 16.70, 74.24, 'city', 'Maharashtra'),
  C('belgaum', 'Belagavi', 15.85, 74.50, 'city', 'Karnataka'), C('hubli', 'Hubballi', 15.36, 75.12, 'city', 'Karnataka'), C('chitradurga', 'Chitradurga', 14.23, 76.40, 'town', 'Karnataka'),
  C('tumkur', 'Tumakuru', 13.34, 77.10, 'town', 'Karnataka'), C('vellore', 'Vellore', 12.92, 79.13, 'city', 'Tamil Nadu'), C('nellore', 'Nellore', 14.44, 79.99, 'city', 'Andhra Pradesh', 'coast'),
  C('ongole', 'Ongole', 15.50, 80.05, 'town', 'Andhra Pradesh', 'coast'), C('vijayawada', 'Vijayawada', 16.51, 80.65, 'major', 'Andhra Pradesh', 'junction'), C('rajahmundry', 'Rajahmundry', 17.00, 81.78, 'city', 'Andhra Pradesh'),
  C('visakhapatnam', 'Visakhapatnam', 17.69, 83.22, 'major', 'Andhra Pradesh', 'port coast'), C('berhampur', 'Berhampur', 19.31, 84.79, 'city', 'Odisha', 'coast'), C('bhubaneswar', 'Bhubaneswar', 20.30, 85.82, 'major', 'Odisha', 'capital'),
  C('cuttack', 'Cuttack', 20.46, 85.88, 'city', 'Odisha'), C('balasore', 'Balasore', 21.49, 86.93, 'town', 'Odisha', 'coast'), C('kharagpur', 'Kharagpur', 22.35, 87.32, 'town', 'West Bengal', 'junction'),
  C('durgapur', 'Durgapur', 23.55, 87.31, 'city', 'West Bengal'), C('dhanbad', 'Dhanbad', 23.80, 86.45, 'city', 'Jharkhand'), C('porbandar', 'Porbandar', 21.64, 69.61, 'town', 'Gujarat', 'port coast'),
  C('rajkot', 'Rajkot', 22.30, 70.80, 'major', 'Gujarat'), C('abu_road', 'Abu Road', 24.48, 72.78, 'town', 'Rajasthan', 'hill'), C('chittorgarh', 'Chittorgarh', 24.88, 74.63, 'town', 'Rajasthan', 'heritage'),
  C('kota', 'Kota', 25.21, 75.86, 'city', 'Rajasthan', 'junction'), C('gorakhpur', 'Gorakhpur', 26.76, 83.37, 'city', 'Uttar Pradesh'), C('muzaffarpur', 'Muzaffarpur', 26.12, 85.39, 'city', 'Bihar'),
  C('siliguri', 'Siliguri', 26.73, 88.40, 'city', 'West Bengal', 'junction hill'), C('guwahati', 'Guwahati', 26.14, 91.74, 'major', 'Assam', 'airport'), C('silchar', 'Silchar', 24.83, 92.78, 'town', 'Assam'),
  C('mathura', 'Mathura', 27.49, 77.67, 'town', 'Uttar Pradesh', 'pilgrimage'), C('ratlam', 'Ratlam', 23.33, 75.04, 'town', 'Madhya Pradesh', 'junction'), C('gaya', 'Gaya', 24.80, 85.00, 'city', 'Bihar', 'pilgrimage'),
  C('asansol', 'Asansol', 23.68, 86.98, 'city', 'West Bengal'), C('balharshah', 'Balharshah', 19.84, 79.35, 'town', 'Maharashtra', 'junction'), C('warangal', 'Warangal', 17.97, 79.60, 'city', 'Telangana'),
  C('guntakal', 'Guntakal', 15.17, 77.37, 'town', 'Andhra Pradesh', 'junction'), C('solapur', 'Solapur', 17.66, 75.91, 'city', 'Maharashtra'), C('rourkela', 'Rourkela', 22.26, 84.85, 'city', 'Odisha'),
  C('raipur', 'Raipur', 21.25, 81.63, 'major', 'Chhattisgarh', 'capital'), C('bhusawal', 'Bhusawal', 21.05, 75.78, 'town', 'Maharashtra', 'junction'), C('nashik', 'Nashik', 20.00, 73.79, 'city', 'Maharashtra', 'pilgrimage'),
  C('tirupati', 'Tirupati', 13.63, 79.42, 'city', 'Andhra Pradesh', 'pilgrimage'), C('coimbatore', 'Coimbatore', 11.02, 76.96, 'city', 'Tamil Nadu'), C('kochi', 'Kochi', 9.93, 76.27, 'major', 'Kerala', 'port coast airport'),
  C('thiruvananthapuram', 'Thiruvananthapuram', 8.52, 76.94, 'major', 'Kerala', 'capital coast airport'), C('mangaluru', 'Mangaluru', 12.91, 74.86, 'city', 'Karnataka', 'port coast'), C('panaji', 'Panaji', 15.50, 73.83, 'city', 'Goa', 'coast capital'),
  C('indore', 'Indore', 22.72, 75.86, 'major', 'Madhya Pradesh'), C('jodhpur', 'Jodhpur', 26.24, 73.02, 'city', 'Rajasthan', 'heritage'), C('jaisalmer', 'Jaisalmer', 26.92, 70.90, 'town', 'Rajasthan', 'heritage desert'),
  C('shimla', 'Shimla', 31.10, 77.17, 'city', 'Himachal Pradesh', 'hill capital'), C('manali', 'Manali', 32.24, 77.19, 'town', 'Himachal Pradesh', 'hill'), C('dehradun', 'Dehradun', 30.32, 78.03, 'city', 'Uttarakhand', 'hill capital'),
  C('leh', 'Leh', 34.15, 77.58, 'town', 'Ladakh', 'hill airport'), C('ranchi', 'Ranchi', 23.34, 85.31, 'major', 'Jharkhand', 'capital'), C('gangtok', 'Gangtok', 27.34, 88.61, 'town', 'Sikkim', 'hill capital'),
  C('munnar', 'Munnar', 10.09, 77.06, 'town', 'Kerala', 'hill tea'), C('ooty', 'Udhagamandalam', 11.41, 76.70, 'town', 'Tamil Nadu', 'hill tea')
];
export const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));

/* highways: kind 'gq' (Golden Quadrilateral sides), 'ns', 'ew', 'nh' (other important links); nh is the usual number, approximate */
const H = (id, name, kind, nh, cities) => ({ id, name, kind, nh, cities: cities.split(' ') });
export const HIGHWAYS = [
  H('gq-delhi-mumbai', 'Delhi to Mumbai', 'gq', 'NH48', 'delhi jaipur ajmer udaipur ahmedabad vadodara surat mumbai'),
  H('gq-mumbai-chennai', 'Mumbai to Chennai', 'gq', 'NH48', 'mumbai pune kolhapur belgaum hubli chitradurga tumkur bengaluru vellore chennai'),
  H('gq-chennai-kolkata', 'Chennai to Kolkata', 'gq', 'NH16', 'chennai nellore ongole vijayawada rajahmundry visakhapatnam berhampur bhubaneswar cuttack balasore kharagpur kolkata'),
  H('gq-kolkata-delhi', 'Kolkata to Delhi', 'gq', 'NH19', 'kolkata durgapur dhanbad varanasi prayagraj kanpur agra mathura delhi'),
  H('ns', 'North-South Corridor', 'ns', 'NH44', 'srinagar jammu pathankot jalandhar ambala delhi agra gwalior jhansi sagar lakhnadon nagpur adilabad nizamabad hyderabad kurnool anantapur bengaluru krishnagiri salem madurai tirunelveli kanyakumari'),
  H('ew', 'East-West Corridor', 'ew', 'NH27', 'porbandar rajkot abu_road udaipur chittorgarh kota jhansi kanpur lucknow gorakhpur muzaffarpur siliguri guwahati silchar'),
  H('nh-pune-hyderabad', 'Pune to Hyderabad', 'nh', 'NH65', 'pune solapur hyderabad'), H('nh-hyderabad-chennai', 'Hyderabad to Chennai via Vijayawada', 'nh', 'NH65', 'hyderabad vijayawada'),
  H('nh-bengaluru-mangaluru', 'Bengaluru to Mangaluru', 'nh', 'NH75', 'bengaluru mangaluru'), H('nh-salem-kochi', 'Salem to Kochi and Thiruvananthapuram', 'nh', 'NH544', 'salem coimbatore kochi thiruvananthapuram'),
  H('nh-mumbai-goa', 'Mumbai to Goa', 'nh', 'NH66', 'mumbai panaji mangaluru kochi'), H('nh-delhi-amritsar', 'Delhi to Amritsar', 'nh', 'NH44', 'delhi ambala jalandhar amritsar'),
  H('nh-delhi-dehradun', 'Delhi to Dehradun', 'nh', 'NH334', 'delhi dehradun'), H('nh-ambala-leh', 'Ambala to Shimla and Manali, Leh', 'nh', 'NH5/NH3', 'ambala chandigarh shimla manali leh'),
  H('nh-jaipur-jodhpur', 'Jaipur to Jodhpur and Jaisalmer', 'nh', 'NH62', 'jaipur ajmer jodhpur jaisalmer'), H('nh-delhi-lucknow', 'Delhi to Lucknow', 'nh', 'NH30', 'delhi kanpur lucknow'),
  H('nh-lucknow-patna', 'Lucknow to Patna', 'nh', 'NH31', 'lucknow varanasi patna'), H('nh-patna-kolkata', 'Patna to Kolkata', 'nh', 'NH19', 'patna gaya dhanbad asansol durgapur kolkata'),
  H('nh-bhopal-indore', 'Bhopal to Indore and Ahmedabad', 'nh', 'NH46', 'bhopal indore ratlam vadodara'), H('nh-nagpur-raipur', 'Nagpur to Raipur and Ranchi', 'nh', 'NH53', 'nagpur raipur rourkela ranchi'),
  H('nh-bhopal-nagpur', 'Bhopal to Nagpur', 'nh', 'NH46', 'bhopal sagar'), H('nh-mumbai-nashik', 'Mumbai to Nashik and Indore', 'nh', 'NH160', 'mumbai nashik bhusawal indore'),
  H('nh-nagpur-warangal', 'Nagpur to Warangal', 'nh', 'NH353/NH163', 'nagpur balharshah warangal hyderabad'), H('nh-chennai-tirupati', 'Chennai to Tirupati', 'nh', 'NH71', 'chennai tirupati'), H('nh-kurnool-guntakal', 'Kurnool to Guntakal and Anantapur', 'nh', 'NH44', 'kurnool guntakal anantapur'),
  H('nh-siliguri-gangtok', 'Siliguri to Gangtok', 'nh', 'NH10', 'siliguri gangtok'), H('nh-madurai-munnar', 'Madurai to Munnar and Kochi (tea hills)', 'nh', 'NH85', 'madurai munnar kochi'), H('nh-coimbatore-ooty', 'Coimbatore to Ooty (the 36 hairpins)', 'nh', 'NH181', 'coimbatore ooty')
];

/* the six trunk railway routes of the Golden Quadrilateral and Golden Diagonal: four sides and two diagonals */
const R = (id, name, kind, cities) => ({ id, name, kind, cities: cities.split(' ') });
export const RAIL = [
  R('rail-delhi-mumbai', 'Delhi to Mumbai', 'side', 'delhi mathura kota ratlam vadodara surat mumbai'), R('rail-delhi-kolkata', 'Delhi to Howrah', 'side', 'delhi kanpur prayagraj varanasi gaya dhanbad asansol kolkata'),
  R('rail-kolkata-chennai', 'Howrah to Chennai', 'side', 'kolkata kharagpur bhubaneswar visakhapatnam vijayawada chennai'), R('rail-chennai-mumbai', 'Chennai to Mumbai', 'side', 'chennai tirupati guntakal solapur pune mumbai'),
  R('rail-delhi-chennai', 'Delhi to Chennai', 'diagonal', 'delhi agra gwalior jhansi bhopal nagpur balharshah warangal vijayawada chennai'), R('rail-kolkata-mumbai', 'Howrah to Mumbai', 'diagonal', 'kolkata kharagpur rourkela raipur nagpur bhusawal nashik mumbai')
];

/* a rough coastline sketch (lat, lon), for drawing only: NOT an authoritative boundary */
export const COAST = [[23.0, 68.6], [22.4, 69.0], [21.64, 69.61], [20.7, 71.0], [21.17, 72.6], [19.08, 72.8], [15.5, 73.7], [12.9, 74.8], [9.9, 76.2], [8.08, 77.5], [8.8, 78.2], [9.3, 79.3], [13.08, 80.3], [15.5, 80.1], [17.7, 83.3], [19.8, 85.8], [21.6, 87.6], [21.7, 88.6]];

const RAD = Math.PI / 180;
export function distanceKm(a, b) {                                              // great-circle distance between two cities or points
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD, h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const ROAD_FACTOR = 1.10;                                                // road length is about 1.1 times the straight line between consecutive cities (calibrated: the four Golden Quadrilateral sides then total about 5,800 km, the published length is 5,846 km)
export function routeKm(ids, factor = ROAD_FACTOR) { let d = 0; for (let i = 1; i < ids.length; i++) d += distanceKm(CITY[ids[i - 1]], CITY[ids[i]]); return d * factor; }
export const gameKm = (km, scale) => km / scale;                                 // distance in game kilometres at a compression (1:scale)
export const driveMinutes = (gKm, kmh = 100) => gKm / kmh * 60;

/* the road graph: cities are nodes, consecutive cities on a highway are edges */
export function roadGraph(highways = HIGHWAYS) {
  const adj = new Map(); const link = (a, b, h) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, hw: h.id, km: routeKm([a, b]) }); };
  for (const h of highways) for (let i = 1; i < h.cities.length; i++) { link(h.cities[i - 1], h.cities[i], h); link(h.cities[i], h.cities[i - 1], h); } return adj;
}
/* shortest road route between two city ids: { cities: [...], km } or null */
export function shortestRoute(from, to, graph = roadGraph()) {
  if (!graph.has(from) || !graph.has(to)) return null; const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
  while (open.size) { let u = null; for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n; open.delete(u); if (u === to) break; for (const e of graph.get(u)) { const nd = dist.get(u) + e.km; if (!dist.has(e.to) || nd < dist.get(e.to)) { dist.set(e.to, nd); prev.set(e.to, u); open.add(e.to); } } }
  if (!dist.has(to)) return null; const path = [to]; while (path[0] !== from) path.unshift(prev.get(path[0])); return { cities: path, km: dist.get(to) };
}
export function nearestCity(lat, lon, tiers = null) { let best = null, bd = Infinity; for (const c of CITIES) { if (tiers && !tiers.includes(c.tier)) continue; const d = distanceKm({ lat, lon }, c); if (d < bd) { bd = d; best = c; } } return best ? { city: best, km: bd } : null; }

/* names in Devanagari for signs (a city missing here is shown in English only) */
export const HINDI = { delhi: 'दिल्ली', mumbai: 'मुंबई', kolkata: 'कोलकाता', chennai: 'चेन्नई', bengaluru: 'बेंगलुरु', hyderabad: 'हैदराबाद', ahmedabad: 'अहमदाबाद', pune: 'पुणे', jaipur: 'जयपुर', lucknow: 'लखनऊ', kanpur: 'कानपुर', nagpur: 'नागपुर', bhopal: 'भोपाल', patna: 'पटना', agra: 'आगरा', varanasi: 'वाराणसी', prayagraj: 'प्रयागराज', amritsar: 'अमृतसर', srinagar: 'श्रीनगर', jammu: 'जम्मू', chandigarh: 'चंडीगढ़', gwalior: 'ग्वालियर', jhansi: 'झाँसी', udaipur: 'उदयपुर', ajmer: 'अजमेर', vadodara: 'वडोदरा', surat: 'सूरत', kolhapur: 'कोल्हापुर', jodhpur: 'जोधपुर', jaisalmer: 'जैसलमेर', shimla: 'शिमला', manali: 'मनाली', dehradun: 'देहरादून', leh: 'लेह', kochi: 'कोच्चि', thiruvananthapuram: 'तिरुवनंतपुरम', mangaluru: 'मंगलुरु', panaji: 'पणजी', coimbatore: 'कोयंबटूर', madurai: 'मदुरै', vijayawada: 'विजयवाड़ा', visakhapatnam: 'विशाखापत्तनम', bhubaneswar: 'भुवनेश्वर', indore: 'इंदौर', raipur: 'रायपुर', ranchi: 'राँची', kota: 'कोटा', solapur: 'सोलापुर', nashik: 'नासिक', rajkot: 'राजकोट', chittorgarh: 'चित्तौड़गढ़', ooty: 'उदगमंडलम', munnar: 'मुन्नार', gangtok: 'गंगटोक', guwahati: 'गुवाहाटी', siliguri: 'सिलीगुड़ी', tirupati: 'तिरुपति', salem: 'सेलम', tumkur: 'तुमकुरु', belgaum: 'बेलगावी', hubli: 'हुब्बल्ली' };

/* the destinations a highway sign near a point would show: the cities next to the nearest city on any highway, with the real road distance (km) */
export function destinationsFor(lat, lon, graph = roadGraph()) {
  const home = nearestCity(lat, lon); if (!home || !graph.has(home.city.id)) return []; const seen = new Set(), out = [];
  for (const e of graph.get(home.city.id)) { if (seen.has(e.to)) continue; seen.add(e.to); out.push({ id: e.to, en: CITY[e.to].name, hi: HINDI[e.to] || '', km: Math.round(e.km) }); }
  return out.sort((a, b) => a.km - b.km);
}
