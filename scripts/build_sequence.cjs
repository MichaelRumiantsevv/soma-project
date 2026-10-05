// Builds the two frame sets the background canvas loads, from the lossless PNG source.
//
//   public/sequence/desktop/frame-NNN.avif  1280x720, AVIF q45
//   public/sequence/mobile/frame-NNN.jpg    405x720 centre strip, JPEG q72 (mozjpeg)
//
// Why two sets (measured on 9 sample frames against the PNG source):
// - The previous AVIF (q70, effort 6) averaged 62 KB/frame (18 MB total) at 43 dB PSNR,
//   well past visible quality. AVIF q45 is 28 KB/frame (8 MB) at 39 dB, still clearly
//   better than the original ezgif JPEGs (34 dB).
// - A portrait phone with cover-fit only ever shows the centre ~9:16 strip of a 16:9
//   frame, so the mobile set is that strip at full source resolution: same sharpness on
//   screen, a third of the pixels.
// - Phones cannot keep 300 decoded frames in memory and re-decode during scroll; JPEG
//   decodes ~4-5x faster than AVIF, which matters more there than the extra bytes.
//
// Usage: node scripts/build_sequence.cjs

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'temp_png');
const OUT_DESKTOP = path.join(ROOT, 'public', 'sequence', 'desktop');
const OUT_MOBILE = path.join(ROOT, 'public', 'sequence', 'mobile');
const TOTAL_FRAMES = 300;
const CONCURRENCY = 8;

// Centre 9:16 strip of the 1280x720 source
const MOBILE_CROP = { left: Math.round((1280 - 405) / 2), top: 0, width: 405, height: 720 };

const pad = (n) => String(n).padStart(3, '0');

async function buildFrame(i) {
  const input = path.join(INPUT_DIR, `ezgif-frame-${pad(i)}.png`);
  if (!fs.existsSync(input)) throw new Error(`missing source ${input}`);

  await sharp(input)
    .removeAlpha()
    .avif({ quality: 45, effort: 4 })
    .toFile(path.join(OUT_DESKTOP, `frame-${pad(i)}.avif`));

  await sharp(input)
    .removeAlpha()
    .extract(MOBILE_CROP)
    .jpeg({ quality: 72, mozjpeg: true, progressive: false })
    .toFile(path.join(OUT_MOBILE, `frame-${pad(i)}.jpg`));
}

async function run() {
  fs.mkdirSync(OUT_DESKTOP, { recursive: true });
  fs.mkdirSync(OUT_MOBILE, { recursive: true });

  const start = Date.now();
  let next = 1;
  let done = 0;
  const worker = async () => {
    while (next <= TOTAL_FRAMES) {
      const i = next++;
      await buildFrame(i);
      done++;
      if (done % 50 === 0 || done === TOTAL_FRAMES) console.log(`${done}/${TOTAL_FRAMES}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const size = (dir) => fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  const mb = (b) => (b / 1048576).toFixed(1);
  console.log(`done in ${((Date.now() - start) / 1000).toFixed(1)}s — desktop ${mb(size(OUT_DESKTOP))} MB, mobile ${mb(size(OUT_MOBILE))} MB`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
