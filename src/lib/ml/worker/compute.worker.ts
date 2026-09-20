/// <reference lib="webworker" />

import { computeField } from "../field";
import { evaluate } from "../metrics";
import { fitModel } from "../registry";
import { DecisionTree } from "../models/decision-tree";
import { NearestCentroid } from "../models/nearest-centroid";
import { RandomForest } from "../models/random-forest";
import { Svm } from "../models/svm";
import type { Sample } from "../types";
import type { FitRequest, FitResponse, WorkerOut } from "./protocol";

/**
 * Model fitting and decision-surface sweeping, off the main thread.
 *
 * This exists because of a measurement, not a preference: dragging a point on
 * the SVM page ran at 8 fps with 76 blocking tasks, because SMO re-solved the
 * whole dual on every pointermove. The page appeared frozen until the mouse was
 * released. With the work in a worker, the pointer stays at 60 fps and the
 * surface simply catches up a beat later.
 *
 * Requests are processed one at a time; the client is responsible for dropping
 * superseded ones (see useAsyncFit), which is what keeps a fast drag from
 * queueing a hundred stale fits.
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function unpack(coords: Float64Array, labels: Int8Array, ids: Int32Array): Sample[] {
  const out: Sample[] = new Array(labels.length);
  for (let i = 0; i < labels.length; i++) {
    out[i] = { id: ids[i], x: [coords[i * 2], coords[i * 2 + 1]], y: labels[i] };
  }
  return out;
}

ctx.onmessage = (e: MessageEvent<FitRequest>) => {
  const req = e.data;
  try {
    const train = unpack(req.coords, req.labels, req.ids);
    const evalSet =
      req.evalCoords && req.evalLabels && req.evalIds
        ? unpack(req.evalCoords, req.evalLabels, req.evalIds)
        : train;

    const t0 = performance.now();
    const { model, parameters } = fitModel(req.algo, train, req.nClasses, req.params);
    const trainMs = performance.now() - t0;

    const field = computeField(model, req.domain, req.resolution);
    const evaluation = evaluate(model, evalSet, req.classNames);

    const extra: FitResponse["extra"] = {};
    let decisionGrid: Float32Array | undefined;

    if (model instanceof Svm) {
      extra.supportIds = [...model.supportVectorIds(train)];
      extra.weights = req.nClasses === 2 ? model.models[0].weights() : null;
      extra.bias = model.models[0]?.b ?? 0;
      if (req.wantDecisionGrid && req.nClasses === 2) {
        decisionGrid = sweepDecision(model, req.domain, req.resolution);
        extra.decisionGrid = decisionGrid;
      }
    } else if (model instanceof NearestCentroid) {
      extra.centroids = model.centroids;
    } else if (model instanceof DecisionTree) {
      extra.leafCount = model.leafCount;
      extra.depth = model.depth;
    } else if (model instanceof RandomForest) {
      extra.leafCount = model.trees.reduce((a, t) => a + t.leafCount, 0);
    }

    const response: FitResponse = {
      id: req.id,
      field: {
        res: field.res,
        xMin: field.xMin,
        xMax: field.xMax,
        yMin: field.yMin,
        yMax: field.yMax,
        label: field.label,
        confidence: field.confidence,
        score: field.score,
      },
      evaluation,
      trainMs,
      parameters,
      extra,
    };

    // Transfer the grid buffers instead of copying them.
    const transfer: Transferable[] = [
      field.label.buffer,
      field.confidence.buffer,
      ...(field.score ? [field.score.buffer] : []),
      ...(decisionGrid ? [decisionGrid.buffer] : []),
    ];
    ctx.postMessage({ kind: "ok", data: response } satisfies WorkerOut, transfer);
  } catch (err) {
    ctx.postMessage({
      kind: "error",
      data: { id: req.id, error: err instanceof Error ? err.message : String(err) },
    } satisfies WorkerOut);
  }
};

/** The raw signed decision function, for drawing SVM margin isolines. */
function sweepDecision(model: Svm, domain: [number, number][], res: number): Float32Array {
  const [[xMin, xMax], [yMin, yMax]] = domain;
  const out = new Float32Array(res * res);
  const probe = [0, 0];
  for (let j = 0; j < res; j++) {
    probe[1] = yMin + ((yMax - yMin) * (j + 0.5)) / res;
    for (let i = 0; i < res; i++) {
      probe[0] = xMin + ((xMax - xMin) * (i + 0.5)) / res;
      out[j * res + i] = model.models[0].decision(probe);
    }
  }
  return out;
}
