import type { Classifier, Sample } from "./types";

export interface Evaluation {
  accuracy: number;
  /** `matrix[trueClass][predictedClass]`. */
  matrix: number[][];
  /** Sample ids the model got wrong — used to highlight them in the plot. */
  wrongIds: number[];
  perClass: {
    name: string;
    support: number;
    precision: number;
    recall: number;
    f1: number;
  }[];
  /** Accuracy of always predicting the largest class — the bar to beat. */
  baseline: number;
}

export function evaluate(model: Classifier, samples: Sample[], classNames: string[]): Evaluation {
  const k = classNames.length;
  const matrix = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const wrongIds: number[] = [];

  for (const s of samples) {
    const p = model.predict(s.x);
    if (s.y >= 0 && s.y < k && p >= 0 && p < k) {
      matrix[s.y][p] += 1;
      if (p !== s.y) wrongIds.push(s.id);
    }
  }

  const total = samples.length || 1;
  let correct = 0;
  for (let i = 0; i < k; i++) correct += matrix[i][i];

  const perClass = classNames.map((name, i) => {
    const support = matrix[i].reduce((a, b) => a + b, 0);
    let predicted = 0;
    for (let r = 0; r < k; r++) predicted += matrix[r][i];
    const tp = matrix[i][i];
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { name, support, precision, recall, f1 };
  });

  const largest = Math.max(0, ...perClass.map((c) => c.support));

  return {
    accuracy: correct / total,
    matrix,
    wrongIds,
    perClass,
    baseline: largest / total,
  };
}

/** Mean squared error, for the regression pages. */
export function mse(yTrue: number[], yPred: number[]): number {
  if (!yTrue.length) return 0;
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) s += (yTrue[i] - yPred[i]) ** 2;
  return s / yTrue.length;
}

/** Coefficient of determination R². */
export function r2(yTrue: number[], yPred: number[]): number {
  if (!yTrue.length) return 0;
  const mean = yTrue.reduce((a, b) => a + b, 0) / yTrue.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < yTrue.length; i++) {
    ssRes += (yTrue[i] - yPred[i]) ** 2;
    ssTot += (yTrue[i] - mean) ** 2;
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}
