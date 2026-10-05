const fs = require('fs');
const path = require('path');

const seqDir = path.join(__dirname, '..', 'public', 'sequence');

let jpgTotal = 0, jpgCount = 0;
let avifTotal = 0, avifCount = 0;

const files = fs.readdirSync(seqDir);
for (const f of files) {
  const size = fs.statSync(path.join(seqDir, f)).size;
  if (f.endsWith('.jpg')) { jpgTotal += size; jpgCount++; }
  if (f.endsWith('.avif')) { avifTotal += size; avifCount++; }
}

console.log('=== JPG (old) ===');
console.log(`  Files: ${jpgCount}`);
console.log(`  Total: ${(jpgTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Avg/frame: ${(jpgTotal / jpgCount / 1024).toFixed(1)} KB`);
console.log('');
console.log('=== AVIF (new, quality 70) ===');
console.log(`  Files: ${avifCount}`);
console.log(`  Total: ${(avifTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Avg/frame: ${(avifTotal / avifCount / 1024).toFixed(1)} KB`);
console.log('');

const diff = ((jpgTotal - avifTotal) / jpgTotal * 100).toFixed(1);
if (avifTotal < jpgTotal) {
  console.log(`AVIF is ${diff}% SMALLER than JPG with MUCH better quality!`);
} else {
  console.log(`AVIF is ${Math.abs(diff)}% larger than JPG, but with dramatically better quality.`);
}
