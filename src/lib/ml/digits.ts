export const DIGIT_SIZE = 16;
export const DIGIT_PIXELS = DIGIT_SIZE * DIGIT_SIZE;

export interface DigitData {
  count: number;
  /** `count × 256` values in [0, 1], row-major. */
  pixels: Float32Array;
  labels: Uint8Array;
}

/**
 * Decode the packed MNIST subset shipped in `public/data/digits16.bin`.
 *
 * Format, little ceremony: an 8-byte header ("ML16", count, size, bits), then
 * one label byte per image, then the images with two 4-bit pixels per byte.
 * Packing halves the download for handwriting, which is nearly binary anyway.
 */
export function decodeDigits(buffer: ArrayBuffer): DigitData {
  const view = new DataView(buffer);
  const magic = view.getUint32(0);
  if (magic !== 0x4d4c3136) throw new Error("Fichier de chiffres inattendu");
  const count = view.getUint16(4);
  const size = view.getUint8(6);
  if (size !== DIGIT_SIZE) throw new Error(`Taille ${size} inattendue`);

  const bytes = new Uint8Array(buffer);
  const packed = DIGIT_PIXELS / 2;
  const labels = bytes.slice(8, 8 + count);
  const pixels = new Float32Array(count * DIGIT_PIXELS);

  for (let k = 0; k < count; k++) {
    const base = 8 + count + k * packed;
    for (let p = 0; p < DIGIT_PIXELS; p += 2) {
      const b = bytes[base + p / 2];
      pixels[k * DIGIT_PIXELS + p] = (b >> 4) / 15;
      pixels[k * DIGIT_PIXELS + p + 1] = (b & 15) / 15;
    }
  }

  return { count, pixels, labels };
}

/** One image as a plain array, for drawing. */
export function digitAt(data: DigitData, index: number): Float32Array {
  return data.pixels.subarray(index * DIGIT_PIXELS, (index + 1) * DIGIT_PIXELS);
}

/**
 * Centre a drawn digit on its centre of mass and scale it to fill the box.
 *
 * MNIST digits are pre-processed this way, so a raw drawing — often small, or
 * off to one side — would be nothing like the training data and the network
 * would look broken when it is merely being asked the wrong question. Doing the
 * same normalisation here is the difference between a demo that works and one
 * that embarrasses itself.
 */
export function normaliseDrawing(src: Float32Array): Float32Array {
  const out = new Float32Array(DIGIT_PIXELS);
  let minX = DIGIT_SIZE;
  let maxX = -1;
  let minY = DIGIT_SIZE;
  let maxY = -1;
  let mass = 0;

  for (let y = 0; y < DIGIT_SIZE; y++) {
    for (let x = 0; x < DIGIT_SIZE; x++) {
      const v = src[y * DIGIT_SIZE + x];
      if (v > 0.08) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        mass += v;
      }
    }
  }
  if (mass === 0 || maxX < 0) return out;

  // Centre of mass of the ink, which is what the frame is centred on below.
  let comX = 0;
  let comY = 0;
  for (let y = 0; y < DIGIT_SIZE; y++) {
    for (let x = 0; x < DIGIT_SIZE; x++) {
      const v = src[y * DIGIT_SIZE + x];
      if (v > 0.08) {
        comX += v * x;
        comY += v * y;
      }
    }
  }
  comX /= mass;
  comY /= mass;

  // Fit the ink into a 12×12 box, as MNIST does, keeping the aspect ratio…
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const scale = 12 / Math.max(w, h);

  // …then centre on the centre of mass, not on the bounding box. The two differ
  // for any digit that is not symmetric — a 7 carries most of its ink at the
  // top — and MNIST centres on the mass. Centring the box instead shifted a
  // drawn square by 1.4 px out of 16, which is a tenth of the image asked of a
  // network trained on centred ones.
  const centre = (DIGIT_SIZE - 1) / 2;

  for (let y = 0; y < DIGIT_SIZE; y++) {
    for (let x = 0; x < DIGIT_SIZE; x++) {
      // Sample the source at the position this output pixel came from.
      const sx = (x - centre) / scale + comX;
      const sy = (y - centre) / scale + comY;
      if (sx < 0 || sy < 0 || sx >= DIGIT_SIZE || sy >= DIGIT_SIZE) continue;
      out[y * DIGIT_SIZE + x] = bilinear(src, sx, sy);
    }
  }
  return out;
}

function bilinear(src: Float32Array, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(DIGIT_SIZE - 1, x0 + 1);
  const y1 = Math.min(DIGIT_SIZE - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = src[y0 * DIGIT_SIZE + x0] * (1 - fx) + src[y0 * DIGIT_SIZE + x1] * fx;
  const b = src[y1 * DIGIT_SIZE + x0] * (1 - fx) + src[y1 * DIGIT_SIZE + x1] * fx;
  return a * (1 - fy) + b * fy;
}
