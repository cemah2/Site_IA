export interface Point2 {
  id: number;
  x: number;
  y: number;
}

export interface LineFit {
  slope: number;
  intercept: number;
}

/**
 * Ordinary least squares in closed form.
 *
 * Shown alongside gradient descent on purpose: for linear regression the exact
 * answer is one formula away, so the learner can see the iterative method
 * *converge to a line they already know is right*. That removes the usual doubt
 * ("is it even going to the correct place?") and leaves the question that
 * actually matters — how fast, and what the learning rate does to it.
 */
export function leastSquares(points: Point2[]): LineFit {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: n ? points[0].y : 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/** Mean squared error of a line — the cost surface the ball rolls down. */
export function lineCost(points: Point2[], slope: number, intercept: number): number {
  if (!points.length) return 0;
  let s = 0;
  for (const p of points) s += (p.y - (slope * p.x + intercept)) ** 2;
  return s / points.length;
}

export interface CostGradient {
  dSlope: number;
  dIntercept: number;
}

/**
 * Analytic gradient of the MSE with respect to (slope, intercept).
 *
 *   J(w, b) = (1/n) Σ (yᵢ − (w·xᵢ + b))²
 *   ∂J/∂w  = −(2/n) Σ xᵢ (yᵢ − ŷᵢ)
 *   ∂J/∂b  = −(2/n) Σ (yᵢ − ŷᵢ)
 */
export function costGradient(points: Point2[], slope: number, intercept: number): CostGradient {
  const n = points.length;
  if (!n) return { dSlope: 0, dIntercept: 0 };
  let ds = 0;
  let di = 0;
  for (const p of points) {
    const residual = p.y - (slope * p.x + intercept);
    ds += -2 * p.x * residual;
    di += -2 * residual;
  }
  return { dSlope: ds / n, dIntercept: di / n };
}

export interface GdStep {
  step: number;
  slope: number;
  intercept: number;
  cost: number;
  dSlope: number;
  dIntercept: number;
  /** Euclidean length of the gradient — how steep it is here. */
  gradientNorm: number;
}

/**
 * Run gradient descent and keep the whole trajectory.
 *
 * The trajectory is the deliverable, not the final answer: plotted on the cost
 * surface it shows the three regimes a learner needs to feel — too small (the
 * path crawls), about right (a smooth curve into the minimum), too large (the
 * path oscillates across the valley and diverges).
 */
export function gradientDescent(
  points: Point2[],
  opts: { lr: number; steps: number; slope0: number; intercept0: number },
): GdStep[] {
  let slope = opts.slope0;
  let intercept = opts.intercept0;
  const out: GdStep[] = [];

  for (let step = 0; step <= opts.steps; step++) {
    const cost = lineCost(points, slope, intercept);
    const g = costGradient(points, slope, intercept);
    out.push({
      step,
      slope,
      intercept,
      cost,
      dSlope: g.dSlope,
      dIntercept: g.dIntercept,
      gradientNorm: Math.hypot(g.dSlope, g.dIntercept),
    });
    // Stop once the numbers blow up — a diverging run is worth showing, but
    // NaN/Infinity would break every chart downstream.
    if (!Number.isFinite(cost) || cost > 1e12) break;
    slope -= opts.lr * g.dSlope;
    intercept -= opts.lr * g.dIntercept;
  }
  return out;
}

/** Design matrix for polynomial regression: [1, x, x², …, x^degree]. */
function vandermonde(x: number, degree: number): number[] {
  const row = new Array<number>(degree + 1);
  row[0] = 1;
  for (let d = 1; d <= degree; d++) row[d] = row[d - 1] * x;
  return row;
}

/**
 * Ridge-regularised polynomial fit, solved with Gaussian elimination on the
 * normal equations. The λ term is not decoration: at degree 12 the unpenalised
 * normal equations are numerically hopeless, and λ = 0 with a near-singular
 * matrix is itself a lesson the over-fitting page makes explicit.
 */
export function polyFit(points: Point2[], degree: number, lambda = 1e-8): number[] {
  const m = degree + 1;
  const A = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const rhs = new Array<number>(m).fill(0);

  for (const p of points) {
    const row = vandermonde(p.x, degree);
    for (let i = 0; i < m; i++) {
      rhs[i] += row[i] * p.y;
      for (let j = 0; j < m; j++) A[i][j] += row[i] * row[j];
    }
  }
  // Never penalise the intercept: doing so shrinks the whole curve toward zero
  // rather than toward flatness.
  for (let i = 1; i < m; i++) A[i][i] += lambda;

  return solve(A, rhs);
}

export function polyEval(coeffs: number[], x: number): number {
  let s = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) s = s * x + coeffs[i];
  return s;
}

/** Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-14) continue;
    [M[col], M[pivot]] = [M[pivot], M[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      if (!factor) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return M.map((row, i) => (Math.abs(row[i]) < 1e-14 ? 0 : row[n] / row[i]));
}
