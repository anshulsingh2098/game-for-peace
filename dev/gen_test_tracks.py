"""Makes a few short, gentle synthesised test tracks so the radio can be checked.
They are only placeholders: delete them and edit music/playlist.json when the real songs arrive."""
import numpy as np, wave, os, json
SR = 22050
os.makedirs('music', exist_ok=True)
def note(f, dur, vol=1.0, attack=0.4):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / attack) * np.exp(-t / (dur * 0.9)) * np.minimum(1, (dur - t) / 0.6)
    return vol * env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t))
def pluck(f, dur=1.4):
    t = np.arange(int(SR * dur)) / SR
    return np.exp(-t * 3.5) * (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t))
def track(name, chords, bpm, seed, bars=8):
    rng = np.random.default_rng(seed); beat = 60 / bpm; bar = 4 * beat; total = int(SR * (bar * bars + 1.5)); out = np.zeros(total)
    for b in range(bars):
        ch = chords[b % len(chords)]; s0 = int(SR * b * bar)
        for f in ch:                                          # soft pad
            n = note(f, bar + 1.0, 0.16); out[s0:s0 + len(n)] += n[:total - s0]
        for k in range(8):                                    # gentle arpeggio
            f = ch[k % len(ch)] * (2 if k % 3 else 1) * (2 if rng.random() < 0.2 else 1)
            p = pluck(f) * 0.12; st = s0 + int(SR * k * beat / 2); out[st:st + len(p)] += p[:total - st]
        bs = note(ch[0] / 2, bar, 0.2, 0.05); out[s0:s0 + len(bs)] += bs[:total - s0]
    out /= max(1e-6, np.abs(out).max()) / 0.8
    fade = int(SR * 1.2); out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)
    path = f'music/{name}.wav'
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
    return path
A, C, F, G, E, D = 220.0, 261.63, 174.61, 196.0, 164.81, 146.83
tracks = [
    ('test-evening-drive', [[A, C * 1, E * 2 * 0.5 * 2], [F, A, C * 2], [C, E * 2 * 0.5 * 2, G], [G, 246.94, D * 2]], 62, 1, 'Test Tone 1 - Evening Drive'),
    ('test-open-road', [[C, E * 2 * 0.5 * 2, G], [G, 246.94, D * 2], [A, C, E * 2 * 0.5 * 2], [F, A, C * 2]], 70, 2, 'Test Tone 2 - Open Road'),
    ('test-night-lights', [[D, F, A], [E, G, 246.94], [F, A, C * 2], [C, E * 2 * 0.5 * 2, G]], 58, 3, 'Test Tone 3 - Night Lights'),
]
lst = []
for name, ch, bpm, sd, title in tracks:
    p = track(name, ch, bpm, sd); lst.append({'title': title, 'artist': 'Placeholder (delete me)', 'file': p}); print(p, os.path.getsize(p) // 1024, 'KB')
json.dump({'stations': [{'name': 'Game for Peace Radio', 'tracks': lst}]}, open('music/playlist.json', 'w'), indent=2)
