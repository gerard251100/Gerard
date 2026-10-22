// Removes the white background from the product photos and trims them tight to the bottle,
// so every bottle scales to the same height in the video.
// Input:  remotion/public/perfumes/originales/<name>.(jpg|png|webp)
// Output: remotion/public/perfumes/<name>.png
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'remotion/public/perfumes/originales';
const OUT = 'remotion/public/perfumes';
// A pixel counts as background if all channels are at least this bright and it touches the border.
const WHITE = 232;
// Pixels this close to the background edge fade out instead of cutting hard.
const FEATHER = 2;
// Photos with a see-through gap (like a handle) whose enclosed white area is background too.
// Not applied to the rest, where enclosed white is part of the bottle (clear glass, highlights).
const FILL_HOLES = ['armaf-odyssey-mandarinsky'];
const MIN_HOLE_AREA = 0.002;

const removeBackground = async (file) => {
  const { data, info } = await sharp(path.join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isWhite = (i) => data[i * 4] >= WHITE && data[i * 4 + 1] >= WHITE && data[i * 4 + 2] >= WHITE;

  // Flood fill from the borders, so white highlights inside the bottle are kept.
  const background = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const i = stack.pop();
    if (background[i] || !isWhite(i)) continue;
    background[i] = 1;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i < width * (height - 1)) stack.push(i + width);
  }

  if (FILL_HOLES.includes(path.parse(file).name)) {
    const seen = new Uint8Array(width * height);
    for (let start = 0; start < width * height; start++) {
      if (seen[start] || background[start] || !isWhite(start)) continue;
      const region = [];
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const i = queue.pop();
        region.push(i);
        const x = i % width;
        for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (n >= 0 && n < width * height && !seen[n] && !background[n] && isWhite(n)) {
            seen[n] = 1;
            queue.push(n);
          }
        }
      }
      if (region.length >= MIN_HOLE_AREA * width * height) for (const i of region) background[i] = 1;
    }
  }

  for (let i = 0; i < width * height; i++) {
    if (background[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const x = i % width;
    const y = Math.floor(i / width);
    let near = FEATHER + 1;
    for (let dy = -FEATHER; dy <= FEATHER; dy++) {
      for (let dx = -FEATHER; dx <= FEATHER; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && background[ny * width + nx]) {
          near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
    }
    if (near <= FEATHER) data[i * 4 + 3] = Math.round((255 * near) / (FEATHER + 1));
  }

  const name = `${path.parse(file).name}.png`;
  await sharp(data, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).png().toFile(path.join(OUT, name));
  console.log(`✓ ${file} → ${OUT}/${name}`);
};

const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
if (files.length === 0) console.log(`No hay fotos en ${SRC}`);
for (const file of files) await removeBackground(file);
