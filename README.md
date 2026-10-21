# Lumi (光色)

LUT filters and color grading for photos and video, right in your browser. Its interface matches its sister project, [Lumark](https://lumark.yucheng208.net). Everything runs locally and files are never uploaded.

Live site: https://lumi.yucheng208.net

## Local preview

```bash
npm run dev        # http://localhost:5180
```

This runs `python3 -m http.server 5180 --directory public`; any static file server works.

## Deploy (Cloudflare)

```bash
npm run deploy     # npx wrangler deploy — static files live in public/, domain settings in wrangler.jsonc
```

## Features

- **Filters**: about 100 built-in looks (FUJIFILM, Canon, Nikon, Sony, Leica, RICOH, Hasselblad, LUMIX, OM System, Apple, plus film stocks, cinematic, black & white and creative looks), with adjustable strength
- **Custom LUTs**: import `.cube` (3D / 1D), `.3dl` and HaldCLUT `.png`; they are saved in the browser (IndexedDB)
- **Camera Log input**: S-Log3, F-Log / F-Log2, Canon Log 3, N-Log, V-Log, LogC3 / LogC4, Apple Log, D-Log, HLG
- **Manual adjustments**: white balance, exposure, contrast, highlights / shadows / whites / blacks, vibrance / saturation, RGB and per-channel curves, 8-color HSL, three-way color grading, vignette, grain, sharpening, fade
- **Workflow**: before/after split view, press and hold the image (or `\`) to see the original, ⌘Z / ⌘⇧Z undo and redo, copy / paste / apply to all files
- **Video & GIF**: playback controls with a timeline (frame count for GIF, minutes:seconds for video)
- **Photos to animation**: combine multiple photos, each with its own adjustments, into a GIF or MP4, with cut, crossfade or crossfade + slow zoom transitions
- **Input formats** (same as Lumark): JPG, PNG, WebP, AVIF, SVG, HEIC, RAW (DNG, NEF, CR2, CR3, ARW, RAF…), GIF, MP4, MOV, MKV, AVI, WMV, WebM
- **Export**: JPEG (optionally keeping EXIF), PNG, WebP, AVIF at full resolution; video as MP4, MOV, WebM or GIF; the current grade as a `.cube` (17 / 33 / 65)
- **Languages**: Traditional Chinese (光色), English (Lumi), Japanese (光色・こうしょく)

## Architecture

| File | Purpose |
| --- | --- |
| `assets/color.js` | Color engine: Log curves, gamut matrices, look parameters and all adjustments baked into a single 3D LUT; `.cube` / `.3dl` / Hald parsing and export |
| `assets/looks.js` | Built-in look parameters (approximations, not official manufacturer LUTs) |
| `assets/gl.js` | WebGL2 renderer: sharpen → 3D LUT → vignette → grain |
| `assets/decode.js` | HEIC (heic-to), RAW (libraw-wasm), SVG, EXIF preservation |
| `assets/media.js` | Video preview transcoding and export via ffmpeg.wasm, applying the same LUT with `lut3d` |
| `assets/widgets.js` | Curve editor, color wheels, histogram |
| `assets/i18n.js` | Translations for the three languages |
| `assets/app.js` | UI and app flow |

The preview, filter thumbnails, histogram and video export all use the same baked LUT, so exported colors match the preview.

## Notes

- Camera and film looks are approximations based on public samples, not official manufacturer LUTs. Brand names are trademarks of their respective owners.
- Third-party licenses are in `public/vendor/*/LICENSE`. The ffmpeg core is loaded from jsDelivr (LGPL/GPL).
