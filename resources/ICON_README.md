# OCR App Icon — Magnifier over Text Lines

## Design

**Concept**: A vermilion magnifier hovering over ink text lines — the canonical
"OCR / recognize & read" gesture, rendered as pure line art.

**Style**: Transparent background, line-art only. No fills, no shadows, no
animation. SVG and ICO are pixel-identical (same static frame).

**Color Scheme** (pulled from the app's CSS variables in
`src/renderer/src/index.css`):

| Role        | Hex       | CSS var        |
|-------------|-----------|----------------|
| Ink text    | `#4a453e` | `--ink-2`      |
| Vermilion   | `#c8442a` | `--vermilion`  |

This replaces the previous amber-honey gradient icon (`#FF9A56 → #FFDD67`) so
the app icon matches the current "paper & ink" UI theme.

## Files

- `icon.svg` — vector source, 256×256, transparent background
- `icon-256.png` — 256×256 PNG rasterized from the SVG (intermediate, tracked in git)
- `icon.ico` — multi-size ICO (256/128/64/48/32/16), gitignored

## Geometry (256×256 viewBox)

```
4 ink text lines (stroke #4a453e, width 8, linecap round):
  y=80   x 56..200
  y=112  x 56..180
  y=144  x 56..200
  y=176  x 56..150

vermilion magnifier (stroke #c8442a):
  ring   cx=138 cy=128 r=48, width 10
  handle (172,162) -> (206,196), width 12, linecap round
```

## Regeneration

```bash
# 1. SVG -> 256 PNG (headless Chrome, preserves transparent background)
google-chrome --headless=new --no-sandbox --disable-gpu \
  --force-device-scale-factor=1 --window-size=256,256 \
  --default-background-color=00000000 \
  --screenshot=resources/icon-256.png \
  file:///path/to/resources/icon.svg

# 2. 256 PNG -> multi-size ICO (Python + Pillow)
python -c "
import struct, io
from PIL import Image
im = Image.open('resources/icon-256.png').convert('RGBA')
sizes = [256, 128, 64, 48, 32, 16]
pngs = {}
for s in sizes:
    if s == 256:
        pngs[s] = open('resources/icon-256.png','rb').read()
    else:
        b = io.BytesIO(); im.resize((s,s), Image.LANCZOS).save(b, 'PNG'); pngs[s] = b.getvalue()
n = len(sizes)
header = struct.pack('<HHH', 0, 1, n)
entries = b''; offset = 6 + 16*n
for s in sizes:
    d = pngs[s]; w = h = (0 if s==256 else s)
    entries += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(d), offset); offset += len(d)
open('resources/icon.ico','wb').write(header + entries + b''.join(pngs[s] for s in sizes))
"
```

## Constraints (from `.claude/CLAUDE.md`)

- `resources/icon.ico` must contain a 256×256 entry or electron-builder aborts
  with `Icon must be at least 256x256 pixels`. Current ICO includes 256/128/64/48/32/16.
- `icon.ico` is gitignored; `icon-256.png` is tracked so the intermediate is recoverable.
- WSL (`/home/arcdent/github/ocr-app/resources/`) and Windows
  (`C:\Users\yanga\Projects\ocr-app\resources/`) must stay in sync — the WSL side is
  the git source, the Windows side is where builds run.
