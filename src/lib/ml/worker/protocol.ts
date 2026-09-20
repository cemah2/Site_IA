import type { AlgoId, AlgoParams } from "../registry";
import type { Evaluation } from "../metrics";

/**
 * The contract between the page and the compute worker.
 *
 * Everything crossing the boundary is a plain object or a typed array, because
 * class instances do not survive structured cloning. Grids come back as typed
 * arrays so their buffers can be *transferred* rather than copied — a 128×128
 * field is 80 KB, and copying that on every drag frame would reintroduce the
 * jank the worker exists to remove.
 */
export interface FitRequest {
  id: number;
  algo: AlgoId;
  params: AlgoParams;
  /** Flat [x0, y0, x1, y1, …] — cheaper to clone than an array of objects. */
  coords: Float64Array;
  labels: Int8Array;
  /** Stable sample ids, so the worker can report results by id. */
  ids: Int32Array;
  nClasses: number;
  domain: [number, number][];
  resolution: number;
  /** Optional held-out set to score against; defaults to the training set. */
  evalCoords?: Float64Array;
  evalLabels?: Int8Array;
  evalIds?: Int32Array;
  classNames: string[];
  /** Also sweep the raw decision function (SVM margins). */
  wantDecisionGrid?: boolean;
}

export interface FieldPayload {
  res: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  label: Int16Array;
  confidence: Float32Array;
  score: Float32Array | null;
}

/** Algorithm-specific extras a page needs but cannot recompute cheaply. */
export interface FitExtra {
  /** SVM: ids of the support vectors, and the decision surface for margins. */
  supportIds?: number[];
  decisionGrid?: Float32Array;
  weights?: number[] | null;
  bias?: number;
  /** Nearest Centroid. */
  centroids?: number[][];
  /** Tree / forest shape, for the stats readouts. */
  leafCount?: number;
  depth?: number;
}

export interface FitResponse {
  id: number;
  field: FieldPayload;
  evaluation: Evaluation;
  trainMs: number;
  parameters: number;
  extra: FitExtra;
}

export interface FitError {
  id: number;
  error: string;
}

export type WorkerOut = { kind: "ok"; data: FitResponse } | { kind: "error"; data: FitError };
