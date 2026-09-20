"use client";

import * as React from "react";
import { computeField } from "@/lib/ml/field";
import { evaluate, type Evaluation } from "@/lib/ml/metrics";
import { fitModel, type AlgoId, type AlgoParams } from "@/lib/ml/registry";
import type { Classifier, Dataset, Field, Sample } from "@/lib/ml/types";

export interface FitState {
  model: Classifier | null;
  field: Field | null;
  trainMs: number;
  parameters: number;
  evaluation: Evaluation | null;
}

/**
 * Fit a model and sweep its decision surface, off the critical input path.
 *
 * `useDeferredValue` is the important part. Fitting and the 80×80 grid sweep
 * take a few milliseconds to a few tens of milliseconds; doing that
 * synchronously inside a slider's onChange makes the slider itself feel
 * broken. Deferring lets React paint the new thumb position immediately and
 * recompute the surface right after, so dragging stays smooth and the
 * visualisation catches up within a frame or two.
 */
export function useFit({
  algo,
  dataset,
  trainSamples,
  testSamples,
  params,
  resolution = 80,
  enabled = true,
}: {
  algo: AlgoId;
  dataset: Dataset;
  trainSamples?: Sample[];
  testSamples?: Sample[];
  params: AlgoParams;
  resolution?: number;
  enabled?: boolean;
}): FitState {
  const train = trainSamples ?? dataset.samples;
  const deferredTrain = React.useDeferredValue(train);
  const deferredParams = React.useDeferredValue(params);
  const nClasses = dataset.classNames.length;

  return React.useMemo<FitState>(() => {
    if (!enabled || deferredTrain.length === 0) {
      return { model: null, field: null, trainMs: 0, parameters: 0, evaluation: null };
    }
    const { model, trainMs, parameters } = fitModel(algo, deferredTrain, nClasses, deferredParams);
    const field = computeField(model, dataset.domain, resolution);
    const evaluation = evaluate(model, testSamples ?? deferredTrain, dataset.classNames);
    return { model, field, trainMs, parameters, evaluation };
    // dataset.domain is a stable literal per dataset; classNames drives nClasses.
  }, [algo, deferredTrain, deferredParams, nClasses, dataset.domain, dataset.classNames, resolution, enabled, testSamples]);
}
