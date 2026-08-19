#!/usr/bin/env python3
"""Re-extract the ISKS asset pack from the source pptx.

Usage:
    python3 tools/extract-assets.py [path/to/ISKS_....pptx]

Writes, relative to css/isks/:
    assets/         the pptx's embedded media, renamed, untouched
    assets/web/     downscaled/optimised variants that the CSS references,
                    plus recolours and the solid lockup matte

Idempotent: safe to re-run when the deck is updated. Needs Pillow.
"""
import os
import shutil
import sys
import zipfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ISKS = os.path.dirname(HERE)
ASSETS = os.path.join(ISKS, 'assets')
WEB = os.path.join(ASSETS, 'web')

def find_pptx():
    """Walk up from css/isks looking for the source deck.

    The pptx is gitignored, so it lives in a working checkout rather than in
    the repo -- which also means this cannot run inside a fresh worktree
    unless you pass the path explicitly.
    """
    import glob
    d = ISKS
    for _ in range(6):
        d = os.path.dirname(d)
        hits = sorted(glob.glob(os.path.join(d, 'ISKS*.pptx')))
        if hits:
            return hits[0]
    return None

# pptx media name -> asset name. Established by inspecting the layouts:
# image1 is the title-slide artwork, image2 the footer bar, image3 the
# gradient+halftone background, image4/5 the two transparent lockups.
RENAME = {
    'ppt/media/image1.jpeg': 'isks-title-background.jpg',
    'ppt/media/image2.png': 'isks-bar.png',
    'ppt/media/image3.png': 'isks-gradient-halftone-background.png',
    'ppt/media/image4.png': 'infosupport-40jaar-logo-white.png',
    'ppt/media/image5.png': 'isks-built-to-last-white.png',
    'docProps/thumbnail.jpeg': 'isks-slide1-thumbnail.jpg',
}

AMBER = (240, 164, 19)
ORANGE = (221, 65, 17)
TEAL = (6, 111, 107)
NAVY = (0, 55, 96)


def unpack(pptx):
    os.makedirs(WEB, exist_ok=True)
    with zipfile.ZipFile(pptx) as z:
        names = set(z.namelist())
        for member, out in RENAME.items():
            if member not in names:
                print('  ! missing in pptx:', member)
                continue
            dst = os.path.join(ASSETS, out)
            with z.open(member) as src, open(dst, 'wb') as fh:
                shutil.copyfileobj(src, fh)
            print('  assets/%s' % out)


def _save(im, path, kind):
    if kind == 'jpg':
        im.convert('RGB').save(path, 'JPEG', quality=84, optimize=True,
                               progressive=True)
    else:
        im.convert('RGBA').save(path, 'PNG', optimize=True)
    print('  assets/web/%s  %dx%d  %.0f KB' % (
        os.path.basename(path), im.width, im.height,
        os.path.getsize(path) / 1024.0))


def resize(src, dst, width, kind):
    im = Image.open(os.path.join(ASSETS, src))
    im = im.resize((width, max(1, round(im.height * width / im.width))),
                   Image.LANCZOS)
    _save(im, os.path.join(WEB, dst), kind)


def recolour(src, dst, rgb, width):
    im = Image.open(os.path.join(ASSETS, src)).convert('RGBA')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = Image.new('RGBA', im.size, rgb + (255,))
    out.putalpha(im.getchannel('A'))
    _save(out, os.path.join(WEB, dst), 'png')


def solid_lockup():
    """Pull the filled two-tone lockup out of the footer-bar artwork.

    The bar's mark is amber glyphs with an offset red-orange shadow on the
    teal gradient. image5 is only the *outlined* cut, so the solid one has
    to come from the bar. Both inks sit ~240 colour-units from the teal
    ground while the ground's own drift plus halftone stays under ~40, so a
    per-column distance ramp over 60..230 keys it cleanly.
    """
    im = Image.open(os.path.join(ASSETS, 'isks-bar.png')).convert('RGB')
    W, H = im.size
    crop = im.crop((int(W * 0.8930), int(H * 0.1000),
                    int(W * 0.9520), int(H * 0.8800)))
    cw, ch = crop.size
    bgs = [min((crop.getpixel((x, y)) for y in range(ch)), key=lambda p: p[0])
           for x in range(cw)]

    LO, HI = 60.0, 230.0
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    op = out.load()
    for x in range(cw):
        bg = bgs[x]
        for y in range(ch):
            p = crop.getpixel((x, y))
            d = sum((p[i] - bg[i]) ** 2 for i in range(3)) ** 0.5
            a = min(1.0, max(0.0, (d - LO) / (HI - LO)))
            if a <= 0.0:
                continue
            if a >= 0.5:
                rgb = tuple(max(0, min(255, int(round(bg[i] + (p[i] - bg[i]) / a))))
                            for i in range(3))
            else:
                # un-premultiplying is unstable this low and leaves a teal
                # halo on light backgrounds; snap to the nearer ink instead
                rgb = min((AMBER, ORANGE), key=lambda ink: sum(
                    (p[i] - bg[i] - (ink[i] - bg[i]) * a) ** 2 for i in range(3)))
            op[x, y] = rgb + (int(round(a * 255)),)

    out = out.crop(out.getbbox())
    # source ink is ~236px wide and the bar shows it at ~5% of slide width,
    # so 400 is already past 1:1 on a 4K display
    out = out.resize((400, round(out.height * 400 / out.width)), Image.LANCZOS)
    _save(out, os.path.join(WEB, 'isks-built-to-last-solid.png'), 'png')


def main():
    pptx = sys.argv[1] if len(sys.argv) > 1 else find_pptx()
    if not pptx or not os.path.exists(pptx):
        sys.exit('source deck not found -- pass it explicitly:\n'
                 '  python3 tools/extract-assets.py /path/to/ISKS_....pptx')
    print('source:', pptx)

    print('unpacking embedded media...')
    unpack(pptx)

    print('building web variants...')
    resize('isks-title-background.jpg', 'isks-title-background.jpg', 1920, 'jpg')
    resize('isks-bar.png', 'isks-bar.jpg', 1920, 'jpg')
    resize('infosupport-40jaar-logo-white.png',
           'infosupport-40jaar-logo-white.png', 900, 'png')
    resize('isks-built-to-last-white.png',
           'isks-built-to-last-white.png', 560, 'png')

    print('recolouring transparent marks...')
    recolour('isks-built-to-last-white.png', 'isks-built-to-last-amber.png', AMBER, 560)
    recolour('isks-built-to-last-white.png', 'isks-built-to-last-teal.png', TEAL, 560)
    recolour('infosupport-40jaar-logo-white.png',
             'infosupport-40jaar-logo-teal.png', TEAL, 900)
    recolour('infosupport-40jaar-logo-white.png',
             'infosupport-40jaar-logo-navy.png', NAVY, 900)

    print('keying the solid lockup out of the bar artwork...')
    solid_lockup()
    print('done.')


if __name__ == '__main__':
    main()
