/**
 * One-off launcher-icon generator.
 *
 * The project can't run `expo prebuild` (it wipes the manual Health Connect
 * manifest edits), so the default Expo template launcher icons (the green
 * Android robot) were never replaced by wowowow.png. This script resizes
 * wowowow.png into the Android mipmap densities and overwrites the stock
 * ic_launcher / ic_launcher_round bitmaps, then removes the old .webp copies
 * so there's no duplicate-resource conflict.
 *
 * Run: node scripts/gen-launcher-icons.js   (from TrainWiseExpo/)
 */
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp-compact');

const SRC = path.join(__dirname, '..', 'assets', 'images', 'wowowow.png');
const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const BG = 0x13173dff; // app.json adaptiveIcon.backgroundColor (#13173d), opaque

// Legacy square launcher sizes per density (px).
const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

(async () => {
  const logo = await Jimp.read(SRC);

  for (const [dir, size] of Object.entries(DENSITIES)) {
    const folder = path.join(RES, dir);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    // Square icon: opaque brand-navy background with the logo centered at
    // ~84% so the launcher's squircle mask never clips the mark.
    const canvas = new Jimp(size, size, BG);
    const inner = Math.round(size * 0.84);
    const scaled = logo.clone().resize(inner, inner);
    canvas.composite(scaled, Math.round((size - inner) / 2), Math.round((size - inner) / 2));

    await canvas.writeAsync(path.join(folder, 'ic_launcher.png'));
    await canvas.writeAsync(path.join(folder, 'ic_launcher_round.png'));

    // Remove the stock template .webp so @mipmap/ic_launcher resolves to the
    // new PNG (two files with the same resource name fails the build).
    for (const old of ['ic_launcher.webp', 'ic_launcher_round.webp']) {
      const p = path.join(folder, old);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    console.log(`✓ ${dir} (${size}px)`);
  }
  console.log('Done. Rebuild with: npx expo run:android --variant release');
})().catch((e) => {
  console.error('Icon generation failed:', e);
  process.exit(1);
});
