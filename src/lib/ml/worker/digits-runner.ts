import type { ActivationName } from "../models/activations";
import type { DigitsIn, DigitsOut } from "./digits.worker";

export interface DigitsEpoch {
  epoch: number;
  trainAcc: number;
  testAcc: number;
  loss: number;
}

export interface DigitsConfig {
  hidden: number[];
  activation: ActivationName;
  learningRate: number;
  trainCount: number;
  seed: number;
}

export interface DigitsState {
  /** `cold` until the model exists; `training` while an epoch is running. */
  phase: "cold" | "ready" | "training";
  trainCount: number;
  testCount: number;
  available: number;
  parameters: number;
  epoch: number;
  history: DigitsEpoch[];
  perClass: number[];
  perClassSeen: number[];
  confusion: Int32Array | null;
  /** `hiddenCount × 256` first-layer weights — one image per hidden neuron. */
  w1: Float32Array | null;
  hiddenCount: number;
  lastEpochMs: number;
  /** Latest prediction for whatever was last drawn. */
  probs: number[] | null;
  hidden: number[] | null;
  /** The model's current answer on each gallery image, in gallery order. */
  gallery: Int8Array | null;
}

export const EMPTY_DIGITS: DigitsState = {
  phase: "cold",
  trainCount: 0,
  testCount: 0,
  available: 0,
  parameters: 0,
  epoch: 0,
  history: [],
  perClass: [],
  perClassSeen: [],
  confusion: null,
  w1: null,
  hiddenCount: 0,
  lastEpochMs: 0,
  probs: null,
  hidden: null,
  gallery: null,
};

/**
 * Drives the digit-recogniser worker, outside React.
 *
 * The loop lives here rather than in an effect because "train until told to
 * stop" is a conversation with a worker, not a render: each epoch that comes
 * back asks for the next one while `playing` holds. Keeping it out of React
 * also means a drawing stroke — which fires a prediction on every pointer move
 * — never competes with the training loop for renders.
 */
export class DigitsRunner {
  private worker: Worker | null = null;
  private state: DigitsState = EMPTY_DIGITS;
  private listeners = new Set<() => void>();
  private playing = false;
  private remaining = 0;
  private predictId = 0;
  private built = false;
  private pendingData: { pixels: Float32Array; labels: Uint8Array } | null = null;
  private pendingConfig: DigitsConfig | null = null;
  /** Re-predicts the last drawing after each epoch, so the answer stays live. */
  private lastPixels: Float32Array | null = null;
  /** Gallery images to re-classify after each epoch. */
  private galleryIndices: number[] = [];

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): DigitsState => this.state;
  getServerSnapshot = (): DigitsState => EMPTY_DIGITS;

  isPlaying = (): boolean => this.playing;

  private emit(next: Partial<DigitsState>) {
    this.state = { ...this.state, ...next };
    for (const fn of this.listeners) fn();
  }

  private send(msg: DigitsIn, transfer: Transferable[] = []) {
    const worker = this.ensureWorker();
    worker?.postMessage(msg, transfer);
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === "undefined") return null;
    const worker = new Worker(new URL("./digits.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<DigitsOut>) => this.receive(e.data);
    this.worker = worker;
    return worker;
  }

  private receive(msg: DigitsOut) {
    if (msg.type === "data-ready") {
      this.emit({ available: msg.available, testCount: msg.testCount });
      if (this.pendingConfig) {
        const cfg = this.pendingConfig;
        this.pendingConfig = null;
        this.build(cfg);
      }
      return;
    }

    if (msg.type === "ready") {
      this.emit({
        phase: "ready",
        trainCount: msg.trainCount,
        testCount: msg.testCount,
        parameters: msg.parameters,
        hiddenCount: msg.hiddenCount,
        w1: msg.w1,
        epoch: 0,
        history: [],
        perClass: [],
        perClassSeen: [],
        confusion: null,
        lastEpochMs: 0,
        probs: null,
        hidden: null,
        gallery: null,
      });
      if (this.lastPixels) this.predict(this.lastPixels);
      this.refreshGallery();
      return;
    }

    if (msg.type === "progress") {
      this.emit({
        epoch: msg.epoch,
        history: [
          ...this.state.history,
          {
            epoch: msg.epoch,
            trainAcc: msg.trainAcc,
            testAcc: msg.testAcc,
            loss: msg.loss,
          },
        ],
        perClass: msg.perClass,
        perClassSeen: msg.perClassSeen,
        confusion: msg.confusion,
        w1: msg.w1,
        lastEpochMs: msg.ms,
        phase: this.playing || this.remaining > 0 ? "training" : "ready",
      });
      // The drawn digit's answer should move with the model, not stay frozen
      // on whatever the untrained network guessed.
      if (this.lastPixels) this.predict(this.lastPixels);
      this.refreshGallery();
      if (this.remaining > 0) this.remaining -= 1;
      if (this.playing || this.remaining > 0) this.send({ type: "train" });
      else if (this.state.phase !== "ready") this.emit({ phase: "ready" });
      return;
    }

    if (msg.type === "batch") {
      this.emit({ gallery: msg.predicted });
      return;
    }

    if (msg.type === "prediction") {
      // Drop an answer a newer stroke has already superseded.
      if (msg.id >= this.predictId) this.emit({ probs: msg.probs, hidden: msg.hidden });
    }
  }

  setData(pixels: Float32Array, labels: Uint8Array): void {
    this.pendingData = { pixels, labels };
    this.send({ type: "data", pixels, labels });
  }

  build(config: DigitsConfig): void {
    this.playing = false;
    this.remaining = 0;
    if (!this.pendingData) {
      this.pendingConfig = config;
      return;
    }
    this.built = true;
    this.send({ type: "build", ...config });
  }

  play(): void {
    if (!this.built) return;
    this.playing = true;
    this.remaining = 0;
    this.emit({ phase: "training" });
    this.send({ type: "train" });
  }

  pause(): void {
    this.playing = false;
    this.remaining = 0;
  }

  /** Run exactly `n` epochs, then stop. */
  step(n = 1): void {
    if (!this.built || this.playing) return;
    this.remaining = n;
    this.emit({ phase: "training" });
    this.send({ type: "train" });
  }

  /** Which dataset images the gallery is showing, so they stay classified. */
  setGallery(indices: number[]): void {
    this.galleryIndices = indices;
    this.refreshGallery();
  }

  private refreshGallery(): void {
    if (!this.built || !this.galleryIndices.length) return;
    this.send({ type: "predict-batch", indices: Int32Array.from(this.galleryIndices) });
  }

  predict(pixels: Float32Array): void {
    this.lastPixels = pixels;
    if (!this.built) return;
    const id = ++this.predictId;
    this.send({ type: "predict", id, pixels });
  }

  clearDrawing(): void {
    this.lastPixels = null;
    this.predictId += 1;
    this.emit({ probs: null, hidden: null });
  }

  /**
   * Tear the worker down and return the runner to a usable state.
   *
   * `playing` and `built` must be cleared: a terminated worker will never reply,
   * so a loop left marked as running would wait on an epoch that can never
   * arrive. React's StrictMode remounts every effect once in development, which
   * makes that the default case rather than an edge case.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.playing = false;
    this.remaining = 0;
    this.built = false;
    this.galleryIndices = [];
    this.pendingData = null;
    this.pendingConfig = null;
  }
}
