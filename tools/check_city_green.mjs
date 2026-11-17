/* Checks the Delhi pack's green areas (forest, scrub, parks, gardens, farmland) against known places and the forest survey's totals: node tools/check_city_green.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { decodeTile } from '../src/world/city/pack.js';
const ROOT = new URL('../', import.meta.url).pathname, dir = ROOT + 'assets/cities/delhi/tiles/', M = JSON.parse(readFileSync(ROOT + 'assets/cities/delhi/manifest.json'));
const area=r=>{let a=0;const n=r.length/2;for(let i=0;i<n;i++){const j=(i+1)%n;a+=r[i*2]*r[j*2+1]-r[j*2]*r[i*2+1]}return Math.abs(a)/2};
const byClass={},luClass={},named={};let tiles=0;
for(const f of readdirSync(dir)){const t=decodeTile(JSON.parse(readFileSync(dir+f,'utf8')),M.tileSize);tiles++;
 for(const p of t.parks||[]){let a=area(p.ring);for(const h of p.holes||[])a-=area(h);byClass[p.class]=(byClass[p.class]||0)+a;const nm=typeof p.name==='string'?p.name:'';if(nm){named[nm]=(named[nm]||0)+a}}
 for(const l of t.landuse||[]){let a=area(l.ring);for(const h of l.holes||[])a-=area(h);luClass[l.class]=(luClass[l.class]||0)+a}}
const km=x=>(x/1e6).toFixed(1);
console.log('tiles',tiles,'pack area km2 about',tiles);
console.log('parks by class km2:',Object.entries(byClass).map(([k,v])=>k+' '+km(v)).join(', '));
console.log('landuse by class km2:',Object.entries(luClass).map(([k,v])=>k+' '+km(v)).join(', '));
const want=['ridge','sanjay','asola','bhatti','lodhi','lodi','nehru','deer','biodiversity','five senses','buddha','talkatora','rose','mughal','coronation','central park','yamuna','jahanpanah','tilpat','aravalli','okhla','zoo','national'];
const hits=Object.entries(named).filter(([n])=>want.some(w=>n.toLowerCase().includes(w))).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([n,a])=>n+' '+km(a));
console.log('named matches:',hits.join(' | '));console.log('total named parks',Object.keys(named).length);
