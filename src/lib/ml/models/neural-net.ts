import { argmax, gaussian, makeRng, shuffle, type Rng } from "@/lib/rng";
import type { Classifier, Sample } from "../types";
import { ACTIVATIONS, softmax, type ActivationName } from "./activations";

export interface LayerTrace {
  /** Pre-activations z = W·a + b for every neuron in the layer. */
  z: number[];
  /** Activations a = f(z). */
  a: number[];
}

export interface ForwardTrace {
  input: number[];
  /** One entry per hidden/output layer, in order. */
  layers: LayerTrace[];
  output: number[];
  predicted: number;
}

export interface BackwardTrace {
  /** dL/dz per layer, ordered like `ForwardTrace.layers`. */
  delta: number[][];
  /** dL/dW per layer: `gradW[l][j][i]` = gradient of weight input i -> neuron j. */
  gradW: number[][][];
  gradB: number[][];
  loss: number;
}

export interface NetConfig {
  /** Neuron counts of the hidden layers only; input/output are implied. */
  hidden: number[];
  activation: ActivationName;
  learningRate: number;
  /** L2 penalty on the weights. 0 = off. */
  l2: number;
  seed: number;
  nInputs: number;
  nOutputs: number;
}

export interface EpochRecord {
  epoch: number;
  trainLoss: number;
  trainAcc: number;
  testLoss: number;
  testAcc: number;
}

/**
 * A small fully-connected network, written so that every intermediate quantity
 * survives the call.
 *
 * A production implementation throws away z, a and δ as soon as it has used
 * them. Here they are returned, because the entire pedagogical claim of the
 * neural-network section is "you can watch the numbers move" — the forward
 * animation needs `z` and `a` per neuron, and the backpropagation animation
 * needs `δ` per neuron and `dL/dW` per connection.
 *
 * Output layer is softmax + cross-entropy. That pairing is chosen deliberately:
 * it makes the output delta collapse to the single expression `δ = ŷ − y`,
 * which is the cleanest possible starting point for explaining the backward
 * pass — no chain rule needed for the first step.
 */
export class NeuralNet implements Classifier {
  /** `W[l][j][i]` = weight from neuron i of layer l-1 to neuron j of layer l. */
  W: number[][][] = [];
  b: number[][] = [];
  readonly sizes: number[];
  readonly nClasses: number;
  history: EpochRecord[] = [];
  epoch = 0;
  private rng: Rng;

  constructor(public config: NetConfig) {
    this.sizes = [config.nInputs, ...config.hidden, config.nOutputs];
    this.nClasses = config.nOutputs;
    this.rng = makeRng(config.seed);
    this.initWeights();
  }

  /**
   * He initialisation for ReLU-family activations, Xavier otherwise. Getting
   * this wrong is one of the classic silent failures: with weights that are too
   * large every neuron saturates on the first forward pass and nothing learns.
   */
  initWeights(): void {
    this.rng = makeRng(this.config.seed);
    this.W = [];
    this.b = [];
    const relu = this.config.activation === "relu" || this.config.activation === "leakyRelu";
    for (let l = 1; l < this.sizes.length; l++) {
      const fanIn = this.sizes[l - 1];
      const scale = relu ? Math.sqrt(2 / fanIn) : Math.sqrt(1 / fanIn);
      this.W.push(
        Array.from({ length: this.sizes[l] }, () =>
          Array.from({ length: fanIn }, () => gaussian(this.rng) * scale),
        ),
      );
      this.b.push(new Array<number>(this.sizes[l]).fill(0));
    }
    this.history = [];
    this.epoch = 0;
  }

  get nLayers(): number {
    return this.W.length;
  }

  forward(x: number[]): ForwardTrace {
    const act = ACTIVATIONS[this.config.activation];
    const layers: LayerTrace[] = [];
    let a = x;

    for (let l = 0; l < this.W.length; l++) {
      const isOutput = l === this.W.length - 1;
      const z = this.W[l].map((row, j) => {
        let s = this.b[l][j];
        for (let i = 0; i < row.length; i++) s += row[i] * a[i];
        return s;
      });
      // Softmax is applied across the whole output layer, not per neuron.
      const out = isOutput ? softmax(z) : z.map(act.f);
      layers.push({ z, a: out });
      a = out;
    }

    return { input: x, layers, output: a, predicted: argmax(a) };
  }

  /**
   * One backward pass for a single sample. Returns the gradients without
   * applying them, so a UI can show "here is what would change" before it
   * changes.
   */
  backward(trace: ForwardTrace, target: number): BackwardTrace {
    const act = ACTIVATIONS[this.config.activation];
    const L = this.W.length;
    const delta: number[][] = new Array(L);
    const gradW: number[][][] = new Array(L);
    const gradB: number[][] = new Array(L);

    // Softmax + cross-entropy: the output delta is simply prediction - truth.
    const out = trace.layers[L - 1].a;
    delta[L - 1] = out.map((p, c) => p - (c === target ? 1 : 0));

    for (let l = L - 2; l >= 0; l--) {
      const next = this.W[l + 1];
      const z = trace.layers[l].z;
      delta[l] = new Array<number>(this.sizes[l + 1]).fill(0);
      for (let j = 0; j < delta[l].length; j++) {
        let s = 0;
        for (let k = 0; k < next.length; k++) s += next[k][j] * delta[l + 1][k];
        delta[l][j] = s * act.df(z[j]);
      }
    }

    for (let l = 0; l < L; l++) {
      const prev = l === 0 ? trace.input : trace.layers[l - 1].a;
      gradW[l] = delta[l].map((d, j) =>
        prev.map((av, i) => d * av + this.config.l2 * this.W[l][j][i]),
      );
      gradB[l] = [...delta[l]];
    }

    const loss = -Math.log(Math.max(out[target] ?? 1e-12, 1e-12));
    return { delta, gradW, gradB, loss };
  }

  applyGradients(grad: BackwardTrace, lr = this.config.learningRate): void {
    for (let l = 0; l < this.W.length; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        for (let i = 0; i < this.W[l][j].length; i++) {
          this.W[l][j][i] -= lr * grad.gradW[l][j][i];
        }
        this.b[l][j] -= lr * grad.gradB[l][j];
      }
    }
  }

  /** One epoch of stochastic gradient descent over a shuffled training set. */
  trainEpoch(train: Sample[], test: Sample[] = []): EpochRecord {
    const rng = makeRng(this.config.seed + this.epoch * 2654435761);
    for (const s of shuffle([...train], rng)) {
      const trace = this.forward(s.x);
      this.applyGradients(this.backward(trace, s.y));
    }
    this.epoch += 1;

    const tr = this.score(train);
    const te = test.length ? this.score(test) : tr;
    const record: EpochRecord = {
      epoch: this.epoch,
      trainLoss: tr.loss,
      trainAcc: tr.acc,
      testLoss: te.loss,
      testAcc: te.acc,
    };
    this.history.push(record);
    return record;
  }

  score(samples: Sample[]): { loss: number; acc: number } {
    if (!samples.length) return { loss: 0, acc: 0 };
    let loss = 0;
    let correct = 0;
    for (const s of samples) {
      const t = this.forward(s.x);
      loss += -Math.log(Math.max(t.output[s.y] ?? 1e-12, 1e-12));
      if (t.predicted === s.y) correct += 1;
    }
    return { loss: loss / samples.length, acc: correct / samples.length };
  }

  predict(x: number[]): number {
    return this.forward(x).predicted;
  }

  predictProba(x: number[]): number[] {
    return this.forward(x).output;
  }

  get parameterCount(): number {
    let n = 0;
    for (let l = 0; l < this.W.length; l++) n += this.W[l].length * (this.W[l][0]?.length ?? 0) + this.b[l].length;
    return n;
  }

  /** Deep copy, used to snapshot "before / after one step" in the UI. */
  clone(): NeuralNet {
    const net = new NeuralNet(this.config);
    net.W = this.W.map((layer) => layer.map((row) => [...row]));
    net.b = this.b.map((row) => [...row]);
    net.history = [...this.history];
    net.epoch = this.epoch;
    return net;
  }
}
