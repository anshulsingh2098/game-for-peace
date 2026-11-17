"""Plots a rectangle of a city pack to a PNG for a quick look (needs Pillow). Build time and checking only.
Usage: python tools/plot_city.py <x0> <z0> <x1> <z1> <metres per pixel> <out.png>   (local metres, x east, z south; Delhi centre is 0 0)
Example: python tools/plot_city.py -1500 -6000 5000 1800 4 delhi_centre.png   (Connaught Place, the Lutyens axis, Old Delhi, the Yamuna)"""
import json, os, sys
from PIL import Image, ImageDraw
D='assets/cities/delhi/'
M=json.load(open(D+'manifest.json')); G=json.load(open(D+'graph.json')); L=json.load(open(D+'landmarks.json'))['landmarks']
cls=G['classes']; ec=G['edges']['cls']; lay=G['edges']['layer']
x0,z0,x1,z1=[float(v) for v in sys.argv[1:5]]; S=float(sys.argv[5]); out=sys.argv[6]
W=int((x1-x0)/S); H=int((z1-z0)/S)
im=Image.new('RGB',(W,H),(238,234,226)); d=ImageDraw.Draw(im)
def dec(p,ox,oz):
    o=[];x=0;z=0
    for i in range(0,len(p),2):
        x+=p[i];z+=p[i+1];o.append(((ox+x/10-x0)/S,(oz+z/10-z0)/S))
    return o
T=1000
for tx in range(int(x0//T),int(x1//T)+1):
  for tz in range(int(z0//T),int(z1//T)+1):
    f=D+'tiles/%d_%d.json'%(tx,tz)
    if not os.path.exists(f): continue
    t=json.load(open(f)); ox=tx*T; oz=tz*T
    for k,col in (('landuse',(232,226,210)),('parks',(190,218,170)),('water',(150,190,225))):
        for a in t[k]:
            if len(a['ring'])>=6: d.polygon(dec(a['ring'],ox,oz),fill=col)
    for a in t['buildings']:
        c={'residential':(205,190,175),'commercial':(215,170,150),'civic':(190,170,200),'religious':(230,200,120)}.get(a['use'],(200,196,190))
        d.polygon(dec(a['ring'],ox,oz),fill=c)
    wid={'motorway':5,'trunk':5,'primary':4,'secondary':3,'tertiary':2,'residential':1,'service':1,'footway':1,'cycleway':1,'busway':2}
    col={'motorway':(230,120,80),'trunk':(235,150,90),'primary':(240,190,100),'secondary':(250,220,130),'tertiary':(255,255,255),'residential':(255,255,255),'service':(250,250,250),'footway':(220,200,200),'cycleway':(200,200,230),'busway':(200,200,200)}
    for s in t['streets']:
        c=cls[ec[s['id']]]
        if lay[s['id']]<0: continue
        pts=dec(s['pts'],ox,oz)
        if len(pts)>=2: d.line(pts,fill=col[c],width=max(1,int(wid[c]*(3/S)*0.7)))
for l in L:
    px=(l['x']-x0)/S; pz=(l['z']-z0)/S
    if 0<=px<W and 0<=pz<H:
        d.ellipse([px-5,pz-5,px+5,pz+5],outline=(200,0,0),width=2)
        d.text((px+7,pz-5),l['id'],fill=(150,0,0))
im.save(out); print(out,W,H)
