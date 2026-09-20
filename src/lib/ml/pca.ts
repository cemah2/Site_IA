/**
 * Principal component analysis, for the one question the import page raises.
 *
 * A real table has a dozen numeric columns and this site draws two axes. Asking
 * the reader to pick two throws away everything the others knew; PCA builds two
 * *new* axes out of all of them, chosen so that as much of the spread as
 * possible survives the projection.
 *
 * The honest caveat, which the page states: the new axes are combinations, so
 * they have no unit and no name. You gain information and lose interpretability
 * — which is exactly the trade every dimension reduction makes.
 */

export interface PcaResult {
  /** Each row projected onto the first two components. */
  points: [number, number][];
  /** Share of the total variance carried by each component, descending. */
  explained: number[];
  /** `loadings[c][j]` = weight of original column j in component c. */
  loadings: number[][];
  /** Column means, kept so a new row can be projected the same way. */
  means: number[];
}

/**
 * Jacobi rotation for symmetric matrices.
 *
 * Chosen over anything cleverer because a covariance matrix here is at most a
 * few dozen columns square, it is always symmetric, and Jacobi is short enough
 * to read: no library, no numerical surprises, and the eigenvectors come out
 * orthonormal by construction.
 */
function symmetricEigen(a: number[][], iterations = 100): { values: number[]; vectors: number[][] } {
  const n = a.length;
  const m = a.map((row) => [...row]);
  // V accumulates the rotations; its columns end up as the eigenvectors.
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let sweep = 0; sweep < iterations; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) off += m[p][q] * m[p][q];
    }
    if (off < 1e-18) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p][q]) < 1e-15) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t =
          Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const values = m.map((row, i) => row[i]);
  const vectors = values.map((_, c) => v.map((row) => row[c]));
  // Descending eigenvalue order: "first component" must mean "most variance".
  const order = values.map((val, i) => ({ val, i })).sort((a, b) => b.val - a.val);
  return {
    values: order.map((o) => values[o.i]),
    vectors: order.map((o) => vectors[o.i]),
  };
}

/**
 * @param rows one array of numbers per sample, all the same length
 * @param standardise divide each column by its standard deviation first.
 *   Without it, a column in euros dominates a column in years purely through
 *   its unit — PCA maximises variance, and variance has a scale.
 */
export function pca(rows: number[][], standardise = true): PcaResult | null {
  const n = rows.length;
  const d = rows[0]?.length ?? 0;
  if (n < 3 || d < 2) return null;

  const means = Array.from({ length: d }, (_, j) => rows.reduce((a, r) => a + r[j], 0) / n);
  const sds = Array.from({ length: d }, (_, j) => {
    const s = Math.sqrt(rows.reduce((a, r) => a + (r[j] - means[j]) ** 2, 0) / n);
    return standardise ? s || 1 : 1;
  });
  const centred = rows.map((r) => r.map((v, j) => (v - means[j]) / sds[j]));

  const cov = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => centred.reduce((a, r) => a + r[i] * r[j], 0) / (n - 1)),
  );

  const { values, vectors } = symmetricEigen(cov);
  const total = values.reduce((a, v) => a + Math.max(0, v), 0) || 1;

  const project = (row: number[], c: number) =>
    row.reduce((a, v, j) => a + v * vectors[c][j], 0);

  return {
    points: centred.map((r) => [project(r, 0), project(r, 1)] as [number, number]),
    explained: values.map((v) => Math.max(0, v) / total),
    loadings: vectors,
    means,
  };
}
