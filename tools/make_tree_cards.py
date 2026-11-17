"""Draws the Delhi tree pictures (assets/nature/delhi_*.png): our own artwork, made by this script (Pillow), 512 x 512 with transparency.
Each picture: the crown fills about 88 percent of the width and the tree (crown and trunk) about 85 percent of the height, the foot of the trunk 5 percent above the bottom edge,
so the game can size a card from a tree's crown radius and height (src/world/city/cityworld.js, streetlife.js). Run: python tools/make_tree_cards.py"""
import random, math, os
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'nature')
S = 512
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def card(name, seed, base, crown, trunk, bloom=None, bloom_p=0.0, leaf=(9, 20), n=2600, hang=0.0, trunk_w=0.032, trunk_h=0.42):
    rnd = random.Random(seed); img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx, foot = S * 0.5, S * 0.95; top = S * 0.10; th = (foot - top) * trunk_h; crown_cy = top + (foot - top - th) * 0.5; rx, ry = S * 0.44 * crown[0], (foot - top - th * 0.8) * 0.5 * crown[1]
    # trunk with two or three limbs, brown-grey
    tw = S * trunk_w; tc = trunk
    d.polygon([(cx - tw, foot), (cx + tw, foot), (cx + tw * 0.55, foot - th), (cx - tw * 0.55, foot - th)], fill=tc + (255,))
    for k in range(rnd.choice((2, 3, 4))):
        a = rnd.uniform(-0.9, 0.9); L = th * rnd.uniform(0.6, 1.1); x0, y0 = cx, foot - th * 0.9; x1, y1 = x0 + math.sin(a) * L, y0 - math.cos(a) * L * 0.8
        d.line([(x0, y0), (x1, y1)], fill=shade(tc, 0.9) + (255,), width=int(tw * 0.9))
    # foliage: leaf clusters, back to front, darker inside and lighter on top
    pts = []
    for i in range(n):
        t = rnd.uniform(0, 2 * math.pi); r = math.sqrt(rnd.random()); x = cx + math.cos(t) * r * rx; y = crown_cy + math.sin(t) * r * ry
        if hang and rnd.random() < hang: y += rnd.uniform(0, ry * 0.25)
        pts.append((y, x, r, t))
    pts.sort()
    for y, x, r, t in pts:
        up = 1.0 - (y - (crown_cy - ry)) / (2 * ry + 1e-6); k = 0.62 + 0.55 * up + rnd.uniform(-0.07, 0.07) - 0.12 * r * 0.3
        col = shade(base, max(0.35, k)); w = rnd.uniform(*leaf); h = w * rnd.uniform(0.5, 0.9)
        if bloom and rnd.random() < bloom_p: col = shade(bloom, rnd.uniform(0.85, 1.1)); w *= 0.85; h *= 0.85
        d.ellipse([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=col + (255,))
    img = img.filter(ImageFilter.GaussianBlur(0.5)); a = img.split()[3].point(lambda v: 255 if v > 90 else 0); img.putalpha(a)
    img.save(os.path.join(OUT, name), optimize=True)
card('delhi_neem.png', 11, (62, 104, 44), (1.0, 0.95), (70, 56, 44), n=3000, leaf=(8, 17))                                    # neem: a dense round dome of small dark leaves
card('delhi_peepal.png', 22, (92, 134, 58), (1.08, 0.82), (88, 76, 62), leaf=(12, 24), n=2300, hang=0.25, trunk_w=0.04)       # peepal: very broad, lighter heart-shaped leaves, a thick pale trunk
card('delhi_jamun.png', 33, (38, 78, 40), (0.78, 1.05), (64, 50, 40), n=3000, leaf=(9, 19), trunk_h=0.36)                    # jamun: tall, oval, dark and glossy
card('delhi_gulmohar.png', 44, (78, 124, 50), (1.1, 0.62), (74, 60, 48), bloom=(214, 72, 40), bloom_p=0.16, n=2300, leaf=(8, 16), trunk_h=0.5)   # gulmohar: a flat umbrella with red blossom
card('delhi_amaltas.png', 55, (96, 140, 56), (0.82, 0.78), (78, 64, 50), bloom=(232, 196, 52), bloom_p=0.22, n=2000, leaf=(8, 17), hang=0.3, trunk_h=0.45)   # amaltas: drooping yellow flowers
card('delhi_kikar.png', 66, (112, 128, 70), (1.05, 0.45), (64, 52, 40), n=1500, leaf=(6, 12), trunk_h=0.6, trunk_w=0.026)     # kikar (vilayati babul): a thin flat umbrella on a slim trunk
print('wrote 6 tree pictures to', OUT)
