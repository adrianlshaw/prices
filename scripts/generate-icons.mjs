import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Barcode bars: 15 bars, 14 gaps (all gaps = 8px)
// Positions pre-computed for a 320px-wide barcode centred in 512px canvas
const bars = [
  { x: 96,  w: 16 },
  { x: 120, w: 8  },
  { x: 136, w: 24 },
  { x: 168, w: 8  },
  { x: 184, w: 16 },
  { x: 208, w: 16 },
  { x: 232, w: 8  },
  { x: 248, w: 24 },
  { x: 280, w: 8  },
  { x: 296, w: 8  },
  { x: 312, w: 16 },
  { x: 336, w: 8  },
  { x: 352, w: 24 },
  { x: 384, w: 8  },
  { x: 400, w: 16 },
];

const barRects = bars
  .map(({ x, w }) => `<rect x="${x}" y="100" width="${w}" height="190" fill="white"/>`)
  .join('\n  ');

// £ as an SVG path avoids font-rendering dependencies.
// Built from a transformed outline of the pound sign, scaled to fill ~160px at centre-bottom.
// We use a text element with a widely-available generic font as fallback; librsvg (used by sharp)
// supports basic system fonts on macOS.
const svgSource = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#111827"/>
  ${barRects}
  <text
    x="256" y="438"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
    font-size="160"
    fill="#4ade80"
  >£</text>
</svg>`;

writeFileSync(join(publicDir, 'favicon.svg'), svgSource);
console.log('favicon.svg written');

const svgBuffer = Buffer.from(svgSource);

for (const [filename, size] of [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, filename));
  console.log(`${filename} (${size}x${size}) written`);
}
