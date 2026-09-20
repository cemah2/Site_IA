"use client";

import { create } from "zustand";
import { NeuralNet, type EpochRecord } from "@/lib/ml/models/neural-net";
import type { ActivationName } from "@/lib/ml/models/activations";
import type { Sample } from "@/lib/ml/types";

interface NetworkState {
  hidden: number[];
  activation: ActivationName;
  learningRate: number;
  l2: number;
  seed: number;
  nOutputs: number;
  net: NeuralNet;
  /** Bumped on every mutation so React re-renders on in-place weight updates. */
  version: number;

  setHidden: (h: number[]) => void;
  setActivation: (a: ActivationName) => void;
  setLearningRate: (v: number) => void;
  setL2: (v: number) => void;
  setSeed: (v: number) => void;
  /** Rebuild when the problem's class count changes. */
  ensureOutputs: (n: number) => void;
  reset: () => void;
  trainEpochs: (train: Sample[], test: Sample[], count: number) => EpochRecord | null;
  /** Apply one sample's gradients — used by the backpropagation page. */
  applyOneStep: (sample: Sample, lr?: number) => void;
  touch: () => void;
}

const DEFAULTS = {
  hidden: [5, 4],
  activation: "tanh" as ActivationName,
  learningRate: 0.09,
  l2: 0,
  seed: 3,
  nOutputs: 2,
};

function build(s: typeof DEFAULTS): NeuralNet {
  return new NeuralNet({
    hidden: s.hidden,
    activation: s.activation,
    learningRate: s.learningRate,
    l2: s.l2,
    seed: s.seed,
    nInputs: 2,
    nOutputs: s.nOutputs,
  });
}

/**
 * One network, shared by the forward / backpropagation / training pages.
 *
 * The three pages are three views of the same object, so a network the learner
 * trained on the training page still has those weights when they go back to
 * watch a forward pass — which is what makes "watch a trained network think"
 * different from "watch a random network think".
 *
 * `version` exists because training mutates the weight arrays in place. Copying
 * a whole network on every epoch would make the live training loop allocate
 * megabytes per second; a version counter is what lets React see the change
 * without that cost.
 */
export const useNetwork = create<NetworkState>((set, get) => ({
  ...DEFAULTS,
  net: build(DEFAULTS),
  version: 0,

  setHidden: (hidden) => set((s) => ({ hidden, net: build({ ...s, hidden }), version: s.version + 1 })),
  setActivation: (activation) =>
    set((s) => ({ activation, net: build({ ...s, activation }), version: s.version + 1 })),
  setLearningRate: (learningRate) =>
    set((s) => {
      s.net.config.learningRate = learningRate;
      return { learningRate, version: s.version + 1 };
    }),
  setL2: (l2) =>
    set((s) => {
      s.net.config.l2 = l2;
      return { l2, version: s.version + 1 };
    }),
  setSeed: (seed) => set((s) => ({ seed, net: build({ ...s, seed }), version: s.version + 1 })),

  ensureOutputs: (n) =>
    set((s) =>
      s.nOutputs === n
        ? s
        : { nOutputs: n, net: build({ ...s, nOutputs: n }), version: s.version + 1 },
    ),

  reset: () =>
    set((s) => {
      s.net.initWeights();
      return { version: s.version + 1 };
    }),

  trainEpochs: (train, test, count) => {
    const { net } = get();
    let last: EpochRecord | null = null;
    for (let i = 0; i < count; i++) last = net.trainEpoch(train, test);
    set((s) => ({ version: s.version + 1 }));
    return last;
  },

  applyOneStep: (sample, lr) => {
    const { net } = get();
    const trace = net.forward(sample.x);
    net.applyGradients(net.backward(trace, sample.y), lr);
    set((s) => ({ version: s.version + 1 }));
  },

  touch: () => set((s) => ({ version: s.version + 1 })),
}));
