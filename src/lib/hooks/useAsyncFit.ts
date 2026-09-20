"use client";

import * as React from "react";
import type { AlgoId, AlgoParams } from "@/lib/ml/registry";
import type { Dataset, Sample } from "@/lib/ml/types";
import type { FitRequest } from "@/lib/ml/worker/protocol";
import { EMPTY_FIT, FitRunner, type FitState } from "@/lib/ml/worker/runner";

/** Flatten samples into transferable buffers. Class instances do not survive
 *  structured cloning, and an array of objects is far slower to clone. */
function pack(samples: Sample[]) {
  const coords = new Float64Array(samples.length * 2);
  const labels = new Int8Array(samples.length);
  const ids = new Int32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    coords[i * 2] = samples[i].x[0];
    coords[i * 2 + 1] = samples[i].x[1];
    labels[i] = samples[i].y;
    ids[i] = samples[i].id;
  }
  return { coords, labels, ids };
}

/**
 * Fit a model and sweep its decision surface without blocking the page.
 *
 * Measured reason this exists: dragging a point on the SVM page ran at 8 fps
 * with 76 blocking tasks, because SMO re-solved the whole dual on every
 * pointermove and the surface only redrew once per drag. Off the main thread,
 * the pointer stays at 60 fps and the surface catches up a beat later.
 */
export function useAsyncFit({
  algo,
  dataset,
  trainSamples,
  testSamples,
  params,
  resolution = 96,
  enabled = true,
  wantDecisionGrid = false,
}: {
  algo: AlgoId;
  dataset: Dataset;
  trainSamples?: Sample[];
  testSamples?: Sample[];
  params: AlgoParams;
  resolution?: number;
  enabled?: boolean;
  wantDecisionGrid?: boolean;
}): FitState {
  const [runner] = React.useState(() => new FitRunner());

  React.useEffect(() => () => runner.dispose(), [runner]);

  const state = React.useSyncExternalStore(
    runner.subscribe,
    runner.getSnapshot,
    runner.getServerSnapshot,
  );

  const train = trainSamples ?? dataset.samples;
  const { classNames, domain } = dataset;

  React.useEffect(() => {
    if (!enabled || !train.length) {
      runner.reset();
      return;
    }
    runner.request((id) => {
      const t = pack(train);
      const req: FitRequest = {
        id,
        algo,
        params,
        coords: t.coords,
        labels: t.labels,
        ids: t.ids,
        nClasses: classNames.length,
        domain,
        resolution,
        classNames,
        wantDecisionGrid,
      };
      if (testSamples?.length) {
        const v = pack(testSamples);
        req.evalCoords = v.coords;
        req.evalLabels = v.labels;
        req.evalIds = v.ids;
      }
      return req;
    });
  }, [
    runner,
    algo,
    params,
    train,
    testSamples,
    classNames,
    domain,
    resolution,
    enabled,
    wantDecisionGrid,
  ]);

  return enabled ? state : EMPTY_FIT;
}
