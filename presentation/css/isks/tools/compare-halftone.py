#!/usr/bin/env python3
"""Check the CSS halftone against the original raster, numerically.

This is how the mask stops in isks.css were tuned: verify.html renders the
original asset and the CSS rebuild as two 16:9 strips, and this script
measures dot energy per column band in each and prints them side by side.

Usage:
    # from presentation/
    node server.js &
    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars \
          --virtual-time-budget=6000 --window-size=1440,2100 --incognito \
          --screenshot=/tmp/verify.png \
          "http://localhost:8000/css/isks/verify.html"
    python3 css/isks/tools/compare-halftone.py /tmp/verify.png

Read the `mean_dev` columns, not `coverage`: once the dots die out, the
coverage metric latches onto gradient dithering and stops meaning anything.
As tuned, mean_dev tracks the original to within ~0.6 on a scale of 8.7.
"""
import sys

from PIL import Image


def main(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size

    def is_page_bg(p):
        return all(abs(p[i] - 17) < 12 for i in range(3))

    runs, inrun, start = [], False, 0
    for y in range(H):
        bg = is_page_bg(im.getpixel((5, y)))
        if not bg and not inrun:
            start, inrun = y, True
        elif bg and inrun:
            runs.append((start, y)); inrun = False
    if inrun:
        runs.append((start, H))

    tall = [r for r in runs if r[1] - r[0] > 400]
    if len(tall) < 2:
        sys.exit('could not isolate both background strips in %s' % path)

    def profile(y0, y1, label):
        print('\n%s  (rows %d-%d)' % (label, y0, y1))
        print('   x%    coverage   mean_dev')
        out = []
        for k in range(0, 13):
            xa, xb = int(W * k * 0.05), int(W * (k * 0.05 + 0.04))
            px = [im.getpixel((x, y)) for y in range(y0 + 20, y1 - 20)
                  for x in range(xa, xb)]
            gs = sorted(p[1] for p in px)
            lo = gs[len(gs) // 20]
            hi = gs[-max(1, len(gs) // 200)]
            if hi - lo < 2:
                out.append((k * 5, 0.0, 0.0))
                print('%5d%%   %.4f     %.2f' % (k * 5, 0.0, 0.0))
                continue
            n = sum(1 for p in px if p[1] > lo + (hi - lo) * 0.5)
            cov = n / float(len(px))
            dev = sum(p[1] - lo for p in px) / float(len(px))
            out.append((k * 5, cov, dev))
            print('%5d%%   %.4f     %.2f' % (k * 5, cov, dev))
        return out

    a = profile(tall[0][0], tall[0][1], 'ORIGINAL raster')
    b = profile(tall[1][0], tall[1][1], 'CSS rebuild')

    print('\n  x%    orig_dev   css_dev   delta')
    tot = 0.0
    for (x, _, da), (_, _, db) in zip(a, b):
        print('%5d%%   %6.2f     %6.2f   %+6.2f' % (x, da, db, db - da))
        if x <= 40:
            tot += abs(db - da)
    print('\nmean |delta| over 0-40%%: %.2f' % (tot / 9.0))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/verify.png')
