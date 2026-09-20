/// <reference lib="webworker" />

import { NeuralNet } from "../models/neural-net";
import { DIGIT_PIXELS } from "../digits";
import type { Sample } from "../types";
import type { ActivationName } from "../models/activations";

/**
 * Trains the digit recogniser, off the main thread.
 *
 * Training 256 → hidden → 10 on a few thousand images is hundreds of millions
 * of multiply-adds per epoch: comfortably fast enough to watch, and comfortably
 * slow enough to freeze a page if it ran on the UI thread.
 *
 * Two design points worth stating, because both are pedagogical rather than
 * technical:
 *
 *  - **One epoch per message.** The worker could loop over thirty epochs by
 *    itself, but a worker busy in a loop cannot read its own inbox, so "pause"
 *    would not respond until the loop ended. Returning after each epoch lets
 *    the page stop the run between any two of them — and the round-trip costs
 *    a fraction of a millisecond against a ~500 ms epoch.
 *  - **The first weight matrix travels back.** Each hidden neuron's 256 input
 *    weights *are* a 16×16 image, and watching those images turn from noise
 *    into stroke detectors is the single most convincing thing this page shows.
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

export interface DigitsData {
  type: "data";
  pixels: Float32Array;
  labels: Uint8Array;
}

export interface DigitsBuild {
  type: "build";
  hidden: number[];
  activation: ActivationName;
  learningRate: number;
  /** How many training images to actually use, for the "more data" experiment. */
  trainCount: number;
  seed: number;
}

export interface DigitsTrain {
  type: "train";
}

export interface DigitsPredict {
  type: "predict";
  id: number;
  pixels: Float32Array;
}

/** Classify a handful of dataset images at once, for the example gallery. */
export interface DigitsPredictBatch {
  type: "predict-batch";
  indices: Int32Array;
}

export type DigitsIn =
  | DigitsData
  | DigitsBuild
  | DigitsTrain
  | DigitsPredict
  | DigitsPredictBatch;

export interface DigitsProgress {
  type: "progress";
  epoch: number;
  trainAcc: number;
  testAcc: number;
  loss: number;
  /** Per-digit recall on the held-out set. */
  perClass: number[];
  /** Per-digit count of held-out images, so recalls can be read honestly. */
  perClassSeen: number[];
  /** Which digit each mistake was taken for: `confusion[truth * 10 + guess]`. */
  confusion: Int32Array;
  /** First-layer weights, `hiddenCount × 256`, for the receptive-field view. */
  w1: Float32Array;
  ms: number;
}

export type DigitsOut =
  | { type: "data-ready"; available: number; testCount: number }
  | {
      type: "ready";
      trainCount: number;
      testCount: number;
      parameters: number;
      hiddenCount: number;
      w1: Float32Array;
    }
  | DigitsProgress
  | {
      type: "prediction";
      id: number;
      probs: number[];
      /** Hidden-layer activations, so the page can draw what the net "sees". */
      hidden: number[];
    }
  | { type: "batch"; indices: Int32Array; predicted: Int8Array };

let net: NeuralNet | null = null;
let all: Sample[] = [];
let trainPool: Sample[] = [];
let train: Sample[] = [];
let test: Sample[] = [];

/** Evaluate, and collect everything the page needs in one pass over the set. */
function score(samples: Sample[]) {
  const hit = new Array<number>(10).fill(0);
  const seen = new Array<number>(10).fill(0);
  const confusion = new Int32Array(100);
  let correct = 0;
  let loss = 0;
  if (!net || !samples.length) {
    return { acc: 0, loss: 0, perClass: hit, perClassSeen: seen, confusion };
  }
  for (const s of samples) {
    const t = net.forward(s.x);
    loss += -Math.log(Math.max(t.output[s.y] ?? 1e-12, 1e-12));
    seen[s.y] += 1;
    confusion[s.y * 10 + t.predicted] += 1;
    if (t.predicted === s.y) {
      correct += 1;
      hit[s.y] += 1;
    }
  }
  return {
    acc: correct / samples.length,
    loss: loss / samples.length,
    perClass: hit.map((h, i) => (seen[i] ? h / seen[i] : 0)),
    perClassSeen: seen,
    confusion,
  };
}

/** The first weight matrix, flattened — one 16×16 image per hidden neuron. */
function firstLayerWeights(): Float32Array {
  if (!net) return new Float32Array(0);
  const rows = net.W[0];
  const out = new Float32Array(rows.length * DIGIT_PIXELS);
  for (let j = 0; j < rows.length; j++) out.set(rows[j], j * DIGIT_PIXELS);
  return out;
}

ctx.onmessage = (e: MessageEvent<DigitsIn>) => {
  const msg = e.data;

  if (msg.type === "data") {
    const total = msg.labels.length;
    all = new Array(total);
    for (let i = 0; i < total; i++) {
      all[i] = {
        id: i,
        x: Array.from(msg.pixels.subarray(i * DIGIT_PIXELS, (i + 1) * DIGIT_PIXELS)),
        y: msg.labels[i],
      };
    }
    // Interleaved split rather than a slice: the file is grouped by digit, so
    // taking the first N for training would hand the model only some digits.
    trainPool = all.filter((_, i) => i % 5 !== 0);
    test = all.filter((_, i) => i % 5 === 0);
    ctx.postMessage({
      type: "data-ready",
      available: trainPool.length,
      testCount: test.length,
    } satisfies DigitsOut);
    return;
  }

  if (msg.type === "build") {
    train = trainPool.slice(0, Math.min(msg.trainCount, trainPool.length));
    net = new NeuralNet({
      hidden: msg.hidden,
      activation: msg.activation,
      learningRate: msg.learningRate,
      l2: 0,
      seed: msg.seed,
      nInputs: DIGIT_PIXELS,
      nOutputs: 10,
    });
    ctx.postMessage({
      type: "ready",
      trainCount: train.length,
      testCount: test.length,
      parameters: net.parameterCount,
      hiddenCount: msg.hidden[0] ?? 0,
      w1: firstLayerWeights(),
    } satisfies DigitsOut);
    return;
  }

  if (msg.type === "train" && net) {
    const t0 = performance.now();
    net.trainEpoch(train);
    const ms = performance.now() - t0;
    // Training accuracy on a capped sample: the number it answers ("does it fit
    // what it has seen?") is just as clear from 1000 images as from 4000, and
    // the epoch stays responsive.
    const tr = score(train.length > 1000 ? train.slice(0, 1000) : train);
    const te = score(test);
    const progress: DigitsProgress = {
      type: "progress",
      epoch: net.epoch,
      trainAcc: tr.acc,
      testAcc: te.acc,
      loss: tr.loss,
      perClass: te.perClass,
      perClassSeen: te.perClassSeen,
      confusion: te.confusion,
      w1: firstLayerWeights(),
      ms,
    };
    ctx.postMessage(progress, [progress.confusion.buffer, progress.w1.buffer]);
    return;
  }

  if (msg.type === "predict-batch" && net) {
    const predicted = new Int8Array(msg.indices.length);
    for (let i = 0; i < msg.indices.length; i++) {
      const sample = all[msg.indices[i]];
      predicted[i] = sample ? net.forward(sample.x).predicted : -1;
    }
    ctx.postMessage({ type: "batch", indices: msg.indices, predicted } satisfies DigitsOut, [
      msg.indices.buffer,
      predicted.buffer,
    ]);
    return;
  }

  if (msg.type === "predict" && net) {
    const trace = net.forward(Array.from(msg.pixels));
    ctx.postMessage({
      type: "prediction",
      id: msg.id,
      probs: trace.output,
      hidden: trace.layers.length > 1 ? trace.layers[0].a : [],
    } satisfies DigitsOut);
  }
};
