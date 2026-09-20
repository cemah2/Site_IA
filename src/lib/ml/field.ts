import type { Classifier, Field } from "./types";

/**
 * Sweep a classifier over a regular grid to obtain the decision surface.
 *
 * This is the single most useful picture in the whole lab: it is literally
 * "what would the model answer at *every* location", so a learner sees the
 * model's opinion about places where no data exists — which is exactly where
 * over-fitting, extrapolation and the effect of K or C become visible.
 *
 * `res` is kept modest (64–120) because the cost is O(res² · cost(predict)) and
 * some models (KNN, kernel SVM) are linear in the training-set size per query.
 */
export function computeField(
  model: Classifier,
  domain: [number, number][],
  res = 96,
): Field {
  const [[xMin, xMax], [yMin, yMax]] = domain;
  const label = new Int16Array(res * res);
  const confidence = new Float32Array(res * res);
  const probe = [0, 0];

  for (let j = 0; j < res; j++) {
    probe[1] = yMin + ((yMax - yMin) * (j + 0.5)) / res;
    for (let i = 0; i < res; i++) {
      probe[0] = xMin + ((xMax - xMin) * (i + 0.5)) / res;
      const idx = j * res + i;
      if (model.predictProba) {
        const p = model.predictProba(probe);
        let best = 0;
        for (let c = 1; c < p.length; c++) if (p[c] > p[best]) best = c;
        label[idx] = best;
        confidence[idx] = p[best];
      } else {
        label[idx] = model.predict(probe);
        confidence[idx] = 1;
      }
    }
  }

  return { res, xMin, xMax, yMin, yMax, label, confidence };
}

/**
 * Cells whose label differs from the neighbour to the right or above — i.e.
 * the decision boundary itself. Drawing it as an explicit stroke (rather than
 * relying on the colour change between two translucent fills) is what makes
 * the boundary legible at low fill opacity.
 */
export function boundaryCells(field: Field): Uint8Array {
  const { res, label } = field;
  const edge = new Uint8Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const idx = j * res + i;
      const l = label[idx];
      if (
        (i + 1 < res && label[idx + 1] !== l) ||
        (j + 1 < res && label[idx + res] !== l)
      ) {
        edge[idx] = 1;
      }
    }
  }
  return edge;
}
