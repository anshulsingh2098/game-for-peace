/* Audit of the Delhi pack for map errors that a person would see (18 Nov 2026): large buildings (2,500 m2 and up) whose footprint lies mostly on a park, garden or sports area, which usually means a station,
   a landmark outline or a mis-tagged polygon drawn as a solid block over open ground (Connaught Place's Central Park was one). Stadiums and sports complexes are expected to appear. Run: node tools/audit_city.mjs */
import fs from 'node:fs';
import { decodeTile } from '../src/world/city/pack.js';
const base=new URL('../assets/cities/delhi', import.meta.url).pathname, man=JSON.parse(fs.readFileSync(base+'/manifest.json')), S=man.tileSize;
const L=new Map(JSON.parse(fs.readFileSync(base+'/landmarks.json')).landmarks.map(l=>[l.id,l]));
const area=r=>{let a=0;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)a+=r[j]*r[i+1]-r[i]*r[j+1];return Math.abs(a)/2;};
const pip=(r,x,z)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){if((r[i+1]>z)!==(r[j+1]>z)&&x<(r[j]-r[i])*(z-r[i+1])/(r[j+1]-r[i+1])+r[i])c=!c;}return c;};
const bb=r=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<r.length;i+=2){x0=Math.min(x0,r[i]);x1=Math.max(x1,r[i]);z0=Math.min(z0,r[i+1]);z1=Math.max(z1,r[i+1]);}return [x0,x1,z0,z1];};
const rows=[]; let tilesN=0;
for(const m of man.tiles){ const f=`${base}/tiles/${m.tx}_${m.tz}.json`; const t=decodeTile(JSON.parse(fs.readFileSync(f)),S); tilesN++;
  const parks=(t.parks||[]).filter(p=>p.class!=='sports'||true).map(p=>({r:p.ring,b:bb(p.ring),name:p.name&&p.name.en,cls:p.class}));
  for(const b of t.buildings||[]){ const a=area(b.ring); if(a<2500) continue; const [x0,x1,z0,z1]=bb(b.ring); let tot=0,hit=0, pn=null; for(let i=0;i<10;i++)for(let j=0;j<10;j++){ const x=x0+(x1-x0)*(i+.5)/10, z=z0+(z1-z0)*(j+.5)/10; if(!pip(b.ring,x,z)) continue; tot++; for(const p of parks){ if(x<p.b[0]||x>p.b[1]||z<p.b[2]||z>p.b[3]) continue; if(pip(p.r,x,z)){hit++; pn=pn||(p.name||p.cls); break;} } }
    if(tot>=10 && hit/tot>0.4) rows.push({tile:m.tx+'_'+m.tz, m2:Math.round(a), overlapPct:Math.round(100*hit/tot), use:b.use, landmark:b.landmark||null, park:pn, h:b.height}); }
}
rows.sort((a,b)=>b.m2-a.m2); console.log('tiles',tilesN,'large buildings (>2500 m2) over parks:',rows.length); console.log(rows.slice(0,25));
