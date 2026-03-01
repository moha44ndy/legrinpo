/**
 * Génère les PNG PWA 192x192 et 512x512 à partir de public/icons/favicon.svg
 * Usage: node scripts/generate-pwa-icons.js
 */
const path = require('path');
const fs = require('fs');

const sharp = require('sharp');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'favicon.svg');
const SIZES = [192, 512];

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log('Created:', outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
