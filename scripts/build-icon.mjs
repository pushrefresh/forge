// Rasterize resources/icon.svg → resources/icon.png at 1024×1024.
// electron-builder takes that PNG and generates the .icns for macOS at
// release time. Run via `npm run build:icon` after editing the SVG.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcSvg = path.resolve(here, '..', 'resources', 'icon.svg');
const outPng = path.resolve(here, '..', 'resources', 'icon.png');

if (!fs.existsSync(srcSvg)) {
  console.error(`missing ${srcSvg}`);
  process.exit(1);
}

const SIZE = 1024;

// `density` controls the SVG rasterization DPI. Bumping it high ensures any
// embedded <pattern fill=…> or bitmap references render crisply at the
// 1024 target size rather than being upscaled from a 96-DPI baseline.
await sharp(srcSvg, { density: 600 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(outPng);

const stat = fs.statSync(outPng);
console.log(
  `wrote ${path.relative(process.cwd(), outPng)} — ${SIZE}×${SIZE}, ${(stat.size / 1024).toFixed(1)} KB`,
);
