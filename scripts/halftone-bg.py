"""Rebuild the Brief Read ground from download.jpg (a halftone-screened photo).

The source is 736x1308 with a ~7.3px dot pitch -- a phone wallpaper. Scaling it
straight to a 2560-wide desktop ground would blow the dots up into 25px blobs and
alias against the dot matrix the page lays over it.

So the screen is taken apart instead: the dots are blurred away to recover the
continuous tone underneath, and that tone alone is shipped (it is low-frequency,
so it upscales for free and compresses to a fraction of the dotted version). The
screen itself is re-drawn in CSS as a repeating gradient multiplied over the
tone, which keeps it pin-sharp at any viewport or pixel ratio.

Writes:
  public/brief-bg.webp   the tone, 1600x1000
  (nothing else -- the dots are drawn by .brief__bg::before in brief.css)
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = '../download.jpg'
OUT = 'public/brief-bg.webp'

W, H = 1600, 1000
PITCH = 7.0          # dot pitch in CSS px -- must match --bf-dot in brief.css
CROP_Y = 20           # source row the landscape window starts at: the top-right
                      # hotspot, so the ground brightens behind the portrait and
                      # falls away under the text column
GAMMA = 0.92


def tone():
    im = Image.open(SRC).convert('RGB')
    sw, sh = im.size
    # blur out the screen; sigma ~ the dot pitch leaves only the photo
    t = im.filter(ImageFilter.GaussianBlur(7.0))
    win_h = int(round(H * sw / W))
    y0 = min(max(CROP_Y, 0), sh - win_h)
    t = t.crop((0, y0, sw, y0 + win_h)).resize((W, H), Image.LANCZOS)
    a = np.asarray(t).astype(np.float64) / 255.0

    # the blur pulled the peaks down (a dot field averages to less than its dots);
    # stretch back so the brightest areas screen at full coverage again
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    amp = np.clip(lum / max(np.percentile(lum, 99.6), 1e-6), 0.0, 1.0) ** GAMMA
    hue = np.clip(a / np.maximum(lum, 1e-6)[..., None], 0.0, 2.2)
    hue = 1.0 + (hue - 1.0) * 1.15          # the print screen reads a touch richer
    return np.clip(hue * amp[..., None], 0.0, 1.0), amp, hue


if __name__ == '__main__':
    rgb, amp, hue = tone()
    img = Image.fromarray((rgb * 255.0 + 0.5).astype(np.uint8))
    img.save(OUT, quality=88, method=6)
    print('wrote', OUT, img.size)
