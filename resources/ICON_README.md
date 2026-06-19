# OCR App Icon - Scanning Beam Design

## Design Specifications

**Concept**: 3D perspective document with animated scanning beam  
**Color Scheme**: Amber-Honey gradient (#FF9A56 → #FFDD67)  
**Style**: Modern, professional, matches UI theme  

## Files

- `icon.svg` - Vector source file (scalable)
- `icon.png` - To be generated from SVG (256×256)
- `icon.ico` - To be converted from PNG (multi-size)

## Generation Steps

### Option 1: Online Tool (Easiest)

1. Open `resources/icon.svg` in browser
2. Take screenshot or export as PNG (256×256)
3. Upload to https://convertio.co/png-ico/ or https://icoconvert.com/
4. Download `icon.ico` with all sizes (16, 32, 48, 64, 128, 256)
5. Save to `resources/icon.ico`

### Option 2: Command Line (ImageMagick)

```bash
# Convert SVG to PNG
convert resources/icon.svg -resize 256x256 resources/icon-256.png

# Convert PNG to ICO with multiple sizes
convert resources/icon-256.png -define icon:auto-resize=256,128,64,48,32,16 resources/icon.ico
```

### Option 3: Inkscape

```bash
# Export PNG from SVG
inkscape resources/icon.svg --export-type=png --export-width=256 --export-filename=resources/icon-256.png

# Then use online tool to convert to .ico
```

## Current Status

✅ SVG source file created  
⏳ PNG export pending  
⏳ ICO conversion pending  

Once `icon.ico` is generated, the build configuration is complete and `npm run make` will use it automatically.

## Design Features

- **3D Perspective**: Document with depth using pseudo-3D shading
- **Gradient Lines**: Text lines using amber-honey gradient
- **Scanning Beam**: White horizontal line with opacity animation (static frame for ICO)
- **Rounded Corners**: 50px radius for modern look
- **Shadow**: Subtle drop shadow for depth

## Notes

- The SVG includes animation for preview only
- The final .ico file will be a static image (key frame of the scanning beam)
- All colors match the application's amber-honey UI theme
