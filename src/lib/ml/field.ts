import type { Classifier, Field } from "./types";

/**
 * Sweep a classifier over a regular grid to obtain the decision surface.
 *
 * This is the single most useful picture in the whole lab: it is literally
 * "what would the model answer at *every* location", so a learner sees the
 * model's opinion about places where no data exists — which is exactly where
 * over-fitting, extrapolation and the effect of K or C become visible.
 *
 * `confidence` is stored as the MARGIN between the best and second-best class,
 * not as the winning probability. With three classes a winner on 0.40 is a
 * near-tie, and "0.40" would shade it as though it were half-sure; the margin
 * is 0 exactly at the boundary and 1 when the model is unanimous, which is the
 * quantity the shading is actually trying to express.
 */
export function computeField(
  model: Classifier,
  domain: [number, number][],
  res = 96,
): Field {
  const [[xMin, xMax], [yMin, yMax]] = domain;
  const label = new Int16Array(res * res);
  const confidence = new Float32Array(res * res);
  const binary = model.nClasses === 2 && Boolean(model.predictProba);
  const score = binary ? new Float32Array(res * res) : null;
  const probe = [0, 0];

  for (let j = 0; j < res; j++) {
    probe[1] = yMin + ((yMax - yMin) * (j + 0.5)) / res;
    for (let i = 0; i < res; i++) {
      probe[0] = xMin + ((xMax - xMin) * (i + 0.5)) / res;
      const idx = j * res + i;

      if (model.predictProba) {
        const p = model.predictProba(probe);
        let best = 0;
        let second = -1;
        for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
        for (let c = 0; c < p.length; c++) {
          if (c !== best && (second < 0 || p[c] > p[second])) second = c;
        }
        label[idx] = best;
        confidence[idx] = second >= 0 ? p[best] - p[second] : 1;
        if (score) score[idx] = p[1] - p[0];
      } else {
        label[idx] = model.predict(probe);
        confidence[idx] = 1;
      }
    }
  }

  return { res, xMin, xMax, yMin, yMax, label, confidence, score };
}

export interface Segment {
  /** Endpoints in data coordinates. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Extract the decision boundary as vector segments.
 *
 * Two paths, because they produce very different quality:
 *
 *  - Binary problems have a continuous signed score (p₁ − p₀), so marching
 *    squares can interpolate along each cell edge and return a *smooth* curve
 *    that is independent of the grid resolution.
 *  - With three or more classes there is no single scalar whose zero level set
 *    is the boundary, so we fall back to emitting a segment between every pair
 *    of adjacent cells that disagree. That is a staircase, but at the
 *    resolutions used here its steps are a few pixels.
 *
 * Either way the boundary is drawn as SVG at full device resolution. Baking it
 * into the low-resolution field image instead would upscale a one-cell line
 * into a thick blurred band — which is what the boundary must never look like,
 * since its exact position is the whole point.
 */
export function boundarySegments(field: Field): Segment[] {
  return field.score ? marchingSquares(field) : cellEdges(field);
}

function cellToData(field: Field, i: number, j: number): [number, number] {
  const { res, xMin, xMax, yMin, yMax } = field;
  return [
    xMin + ((xMax - xMin) * (i + 0.5)) / res,
    yMin + ((yMax - yMin) * (j + 0.5)) / res,
  ];
}

function cellEdges(field: Field): Segment[] {
  const { res, label } = field;
  const out: Segment[] = [];
  const stepX = (field.xMax - field.xMin) / res;
  const stepY = (field.yMax - field.yMin) / res;

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      if (i + 1 < res && label[idx + 1] !== label[idx]) {
        const [x, y] = cellToData(field, i + 0.5, j);
        out.push({ x1: x, y1: y - stepY / 2, x2: x, y2: y + stepY / 2 });
      }
      if (j + 1 < res && label[idx + res] !== label[idx]) {
        const [x, y] = cellToData(field, i, j + 0.5);
        out.push({ x1: x - stepX / 2, y1: y, x2: x + stepX / 2, y2: y });
      }
    }
  }
  return out;
}

/** Standard marching squares on the signed score, at level 0. */
function marchingSquares(field: Field): Segment[] {
  const { res, score } = field;
  if (!score) return [];
  const out: Segment[] = [];

  // Linear interpolation of the crossing point between two sampled values.
  const lerp = (a: number, b: number) => (Math.abs(b - a) < 1e-12 ? 0.5 : -a / (b - a));

  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const v00 = score[j * res + i];
      const v10 = score[j * res + i + 1];
      const v01 = score[(j + 1) * res + i];
      const v11 = score[(j + 1) * res + i + 1];

      const code =
        (v00 > 0 ? 1 : 0) | (v10 > 0 ? 2 : 0) | (v11 > 0 ? 4 : 0) | (v01 > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const [x0, y0] = cellToData(field, i, j);
      const [x1, y1] = cellToData(field, i + 1, j + 1);

      // Crossing points on each of the four cell edges.
      const bottom: [number, number] = [x0 + (x1 - x0) * lerp(v00, v10), y0];
      const right: [number, number] = [x1, y0 + (y1 - y0) * lerp(v10, v11)];
      const top: [number, number] = [x0 + (x1 - x0) * lerp(v01, v11), y1];
      const left: [number, number] = [x0, y0 + (y1 - y0) * lerp(v00, v01)];

      const push = (a: [number, number], b: [number, number]) =>
        out.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });

      switch (code) {
        case 1:
        case 14:
          push(left, bottom);
          break;
        case 2:
        case 13:
          push(bottom, right);
          break;
        case 3:
        case 12:
          push(left, right);
          break;
        case 4:
        case 11:
          push(right, top);
          break;
        case 6:
        case 9:
          push(bottom, top);
          break;
        case 7:
        case 8:
          push(left, top);
          break;
        // Saddle cells: two separate crossings. Resolved by the centre's sign.
        case 5:
          if ((v00 + v10 + v01 + v11) / 4 > 0) {
            push(left, top);
            push(bottom, right);
          } else {
            push(left, bottom);
            push(right, top);
          }
          break;
        case 10:
          if ((v00 + v10 + v01 + v11) / 4 > 0) {
            push(left, bottom);
            push(right, top);
          } else {
            push(left, top);
            push(bottom, right);
          }
          break;
      }
    }
  }
  return out;
}
