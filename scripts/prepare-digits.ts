/**
 * Build the embedded handwritten-digit dataset from MNIST.
 *
 * Run once, offline: `npx tsx scripts/prepare-digits.ts`. The output is
 * committed, so the site never depends on a network fetch at build time.
 *
 * Choices, all driven by what the page needs rather than by fidelity:
 *  - **16×16 instead of 28×28.** 256 inputs is small enough to train in the
 *    browser in a few seconds and small enough to *draw* the input layer, which
 *    is the point of the page. Digits stay perfectly legible at that size.
 *  - **4 bits per pixel, two pixels per byte.** Handwriting is nearly binary;
 *    16 grey levels are visually indistinguishable from 256 here and halve the
 *    payload.
 *  - **5 000 images.** Enough to train a small network to ~93 % on held-out
 *    digits, which is the honest number the page reports.
 */
import { createWriteStream } from "node:fs";
import { gunzipSync } from "node:zlib";

const IMAGES = "https://storage.googleapis.com/cvdf-datasets/mnist/train-images-idx3-ubyte.gz";
const LABELS = "https://storage.googleapis.com/cvdf-datasets/mnist/train-labels-idx1-ubyte.gz";
const OUT = "public/data/digits16.bin";
const SIZE = 16;
const COUNT = 5000;

async function fetchIdx(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return gunzipSync(Buffer.from(await res.arrayBuffer()));
}

/** Box-filter downscale from 28×28 to 16×16, then quantise to 4 bits. */
function downscale(src: Buffer, offset: number): Uint8Array {
  const out = new Uint8Array(SIZE * SIZE);
  const scale = 28 / SIZE;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(28, Math.ceil((x + 1) * scale));
      const y0 = Math.floor(y * scale);
      const y1 = Math.min(28, Math.ceil((y + 1) * scale));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sum += src[offset + yy * 28 + xx];
          n++;
        }
      }
      out[y * SIZE + x] = Math.round(sum / Math.max(1, n) / 17); // 0..255 -> 0..15
    }
  }
  return out;
}

async function main() {
  console.log("téléchargement de MNIST…");
  const [imgRaw, lblRaw] = await Promise.all([fetchIdx(IMAGES), fetchIdx(LABELS)]);

  const imgMagic = imgRaw.readUInt32BE(0);
  const lblMagic = lblRaw.readUInt32BE(0);
  if (imgMagic !== 2051 || lblMagic !== 2049) {
    throw new Error(`en-têtes IDX inattendus : ${imgMagic}, ${lblMagic}`);
  }
  const total = imgRaw.readUInt32BE(4);
  console.log(`${total} images disponibles, ${COUNT} retenues`);

  // Balanced across the ten digits, so no class is over-represented.
  const perDigit = Math.floor(COUNT / 10);
  const taken = new Array(10).fill(0);
  const chosen: number[] = [];
  for (let i = 0; i < total && chosen.length < perDigit * 10; i++) {
    const d = lblRaw[8 + i];
    if (taken[d] < perDigit) {
      taken[d] += 1;
      chosen.push(i);
    }
  }

  const n = chosen.length;
  const packed = SIZE * SIZE / 2;
  const buf = Buffer.alloc(8 + n + n * packed);
  buf.writeUInt32BE(0x4d4c3136, 0); // "ML16"
  buf.writeUInt16BE(n, 4);
  buf.writeUInt8(SIZE, 6);
  buf.writeUInt8(4, 7); // bits per pixel

  chosen.forEach((idx, k) => {
    buf[8 + k] = lblRaw[8 + idx];
    const px = downscale(imgRaw, 16 + idx * 784);
    for (let p = 0; p < px.length; p += 2) {
      buf[8 + n + k * packed + p / 2] = (px[p] << 4) | px[p + 1];
    }
  });

  await new Promise<void>((resolve, reject) => {
    const s = createWriteStream(OUT);
    s.on("error", reject);
    s.on("finish", resolve);
    s.end(buf);
  });

  console.log(`écrit ${OUT} — ${n} images, ${(buf.length / 1024).toFixed(0)} Ko`);
  console.log("répartition :", taken.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
