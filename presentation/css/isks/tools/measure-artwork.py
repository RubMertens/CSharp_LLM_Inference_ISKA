#!/usr/bin/env python3
"""Print the measurements that isks-tokens.css is derived from.

Usage:
    python3 tools/measure-artwork.py

Reads the extracted assets (run extract-assets.py first) and reports the
gradient stops, halftone grid, halftone falloff, and footer-bar element
geometry. Re-run after a deck update to check whether the tokens still
hold. Needs Pillow.
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(os.path.dirname(HERE), 'assets')

TEAL_BRIGHT = (28, 134, 128)


def rule(title):
    print('\n' + title)
    print('-' * len(title))


def gradient_stops():
    rule('BACKGROUND GRADIENT (horizontal)')
    im = Image.open(os.path.join(ASSETS, 'isks-gradient-halftone-background.png')).convert('RGB')
    w, h = im.size
    print('asset %dx%d' % (w, h))
    for f in (0.0, 0.25, 0.5, 0.75, 1.0):
        x = min(int(w * f), w - 1)
        p = im.getpixel((x, int(h * 0.5)))
        print('  x=%3.0f%%  #%02X%02X%02X' % (f * 100, *p))
    print('  tokens: --isks-navy #003760 / --isks-mid #005C75 / --isks-teal-bright #1C8680')


def halftone():
    rule('HALFTONE GRID + FALLOFF')
    im = Image.open(os.path.join(ASSETS, 'isks-gradient-halftone-background.png')).convert('RGB')
    w, h = im.size
    P = 121
    print('grid pitch %dpx of %dpx = %.4f%% of width  (--isks-dot-pitch)' % (P, w, P / float(w) * 100))
    print('\n   x%     bg          dot         alpha  coverage  dia/pitch')
    for k in range(0, 40):
        x0 = k * P * 2
        if x0 + P > w:
            break
        px = [im.getpixel((x, y)) for y in range(200, 200 + P) for x in range(x0, x0 + P)]
        gs = sorted(p[1] for p in px)
        bg_g, peak_g = gs[len(gs) // 10], gs[-1]
        bg = min(px, key=lambda p: p[1])
        dot = max(px, key=lambda p: p[1])
        n = sum(1 for p in px if p[1] > bg_g + max(2, (peak_g - bg_g) * 0.5))
        cov = n / float(P * P)
        al = [(dot[i] - bg[i]) / float(TEAL_BRIGHT[i] - bg[i])
              for i in range(3) if abs(TEAL_BRIGHT[i] - bg[i]) > 6]
        a = sum(al) / len(al) if al else 0.0
        dia = 2 * (cov / 3.14159) ** 0.5
        print('%5.1f%%  %-11s %-11s %.3f  %.4f    %.3f'
              % (x0 / float(w) * 100, str(bg), str(dot), a, cov, dia))
        if cov < 0.0005:
            print('  -> field ends near x=%.1f%%' % (x0 / float(w) * 100))
            break
    print('  tokens: --isks-dot-color rgba(28,134,128,0.40), radius 36% of pitch')


def bar_geometry():
    rule('FOOTER BAR ELEMENT GEOMETRY (% of the bar box)')
    im = Image.open(os.path.join(ASSETS, 'isks-bar.png')).convert('RGB')
    w, h = im.size
    print('asset %dx%d  (aspect h/w = %.4f)' % (w, h, h / float(w)))

    def white(p):
        return p[0] > 195 and p[1] > 195 and p[2] > 195

    def amber(p):
        return p[0] > 185 and 115 < p[1] < 205 and p[2] < 95

    def bbox(pred, x0, x1):
        xs, ys = [], []
        for x in range(x0, x1):
            for y in range(h):
                if pred(im.getpixel((x, y))):
                    xs.append(x); ys.append(y)
        if not xs:
            return None
        return (min(xs) / float(w) * 100, min(ys) / float(h) * 100,
                max(xs) / float(w) * 100, max(ys) / float(h) * 100)

    for name, b in [
        ('logo', bbox(white, 0, int(w * 0.14))),
        ('amber rule', bbox(amber, int(w * 0.14), int(w * 0.17))),
        ('ISKS (white)', bbox(white, int(w * 0.17), int(w * 0.30))),
        ('2026 (amber)', bbox(amber, int(w * 0.17), int(w * 0.30))),
        ('lockup', bbox(amber, int(w * 0.85), w)),
    ]:
        if not b:
            print('  %-14s none' % name)
            continue
        print('  %-14s x %6.2f%% -> %6.2f%% (w %5.2f%%)   y %6.2f%% -> %6.2f%% (h %5.1f%%)'
              % (name, b[0], b[2], b[2] - b[0], b[1], b[3], b[3] - b[1]))
    print('  bar dot pitch: 53px of %d = %.4f%% of width  (--isks-bar-dot-pitch)'
          % (w, 53 / float(w) * 100))


def title_slide():
    rule('TITLE SLIDE MOTIFS')
    im = Image.open(os.path.join(ASSETS, 'isks-title-background.jpg')).convert('RGB')
    w, h = im.size
    print('asset %dx%d' % (w, h))

    def is_amber(p):
        return p[0] > 190 and 120 < p[1] < 200 and p[2] < 90

    print('  amber diagonal, x position of the stroke by row:')
    for f in (0.0, 0.5, 0.99):
        y = min(int(h * f), h - 1)
        xs = [x for x in range(w) if is_amber(im.getpixel((x, y)))]
        runs = []
        if xs:
            start = prev = xs[0]
            for x in xs[1:]:
                if x - prev > 12:
                    runs.append((start, prev)); start = x
                prev = x
            runs.append((start, prev))
        runs = [r for r in runs if r[1] - r[0] > 20]
        print('    y=%3.0f%%  %s' % (f * 100, ['%.2f%%-%.2f%%' % (a / w * 100, b / w * 100)
                                               for a, b in runs]))
    print('  -> .isks-diagonal clip-path 67.99/68.88% at top, 42.19/41.30% at bottom')

    x = int(w * 0.10)
    prev = None
    print('  teal band vertical extent at x=10%:')
    for y in range(int(h * 0.60), int(h * 0.95)):
        p = im.getpixel((x, y))
        lab = 'band' if p[1] > 120 else 'base'
        if lab != prev:
            print('    y=%.2f%%  %s  #%02X%02X%02X' % (y / h * 100, lab, *p))
            prev = lab
    print('  -> .isks-band top 73.54%, height 14.99%')


if __name__ == '__main__':
    gradient_stops()
    halftone()
    bar_geometry()
    title_slide()
