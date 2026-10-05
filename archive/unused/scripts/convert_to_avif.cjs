const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = path.join(__dirname, '..', 'temp_png');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sequence');
const TOTAL_FRAMES = 300;
const CONCURRENCY = 12;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function convertFrame(i) {
  const pad = String(i).padStart(3, '0');
  const inputPath = path.join(INPUT_DIR, `ezgif-frame-${pad}.png`);
  const outputPath = path.join(OUTPUT_DIR, `ezgif-frame-${pad}.avif`);

  if (!fs.existsSync(inputPath)) {
    console.warn(`File not found: ${inputPath}`);
    return;
  }

  await sharp(inputPath)
    .avif({ quality: 70, effort: 6 })
    .toFile(outputPath);
}

async function run() {
  console.log(`Starting conversion of ${TOTAL_FRAMES} frames from PNG to AVIF...`);
  const startTime = Date.now();

  let completed = 0;
  let currentIndex = 1;

  async function worker() {
    while (currentIndex <= TOTAL_FRAMES) {
      const idx = currentIndex++;
      try {
        await convertFrame(idx);
        completed++;
        if (completed % 25 === 0 || completed === TOTAL_FRAMES) {
          console.log(`Progress: ${completed}/${TOTAL_FRAMES} frames converted (${Math.round(completed/TOTAL_FRAMES*100)}%)`);
        }
      } catch (err) {
        console.error(`Error converting frame ${idx}:`, err.message);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Conversion completed in ${duration}s!`);
}

run();
