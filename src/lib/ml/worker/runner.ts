import type { Evaluation } from "../metrics";
import type { Field } from "../types";
import type { FitExtra, FitRequest, WorkerOut } from "./protocol";

export interface FitState {
  field: Field | null;
  evaluation: Evaluation | null;
  trainMs: number;
  parameters: number;
  extra: FitExtra;
  /** A newer fit is in flight; what is on screen is one step behind. */
  pending: boolean;
  /** Nothing has come back yet — show a skeleton, not an empty plot. */
  cold: boolean;
}

export const EMPTY_FIT: FitState = {
  field: null,
  evaluation: null,
  trainMs: 0,
  parameters: 0,
  extra: {},
  pending: false,
  cold: true,
};

let nextId = 1;

/**
 * Drives one compute worker, outside React.
 *
 * Kept as a plain external store — subscribed to with `useSyncExternalStore` —
 * rather than as effects and `setState`, because the update that matters here
 * arrives from a worker message, not from a render. Modelling it as external
 * state is both what it is and what keeps React from re-rendering in cascades.
 *
 * Two behaviours make the difference between "technically async" and actually
 * smooth:
 *
 *  - **One request in flight.** While the worker is busy, a newer request
 *    overwrites a single pending slot instead of queueing. A drag producing two
 *    hundred pointer events causes a handful of fits, and the one that finally
 *    runs is always the newest state.
 *  - **The last good result stays on screen.** Blanking the surface while the
 *    next one computes would make every drag flicker.
 */
export class FitRunner {
  private worker: Worker | null = null;
  private busy = false;
  private queued: FitRequest | null = null;
  private latestId = 0;
  private state: FitState = EMPTY_FIT;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): FitState => this.state;

  /** Server snapshot: identical object every time, as the API requires. */
  getServerSnapshot = (): FitState => EMPTY_FIT;

  private emit(next: FitState) {
    this.state = next;
    for (const fn of this.listeners) fn();
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === "undefined") return null;
    const worker = new Worker(new URL("./compute.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      this.busy = false;

      if (e.data.kind === "ok") {
        const d = e.data.data;
        // Ignore a result a newer request has already superseded.
        if (d.id >= this.latestId) {
          this.emit({
            field: { ...d.field },
            evaluation: d.evaluation,
            trainMs: d.trainMs,
            parameters: d.parameters,
            extra: d.extra,
            pending: this.queued !== null,
            cold: false,
          });
        }
      } else if (process.env.NODE_ENV !== "production") {
        console.error("compute worker:", e.data.data.error);
      }

      const queued = this.queued;
      this.queued = null;
      if (queued) this.post(queued);
    };
    this.worker = worker;
    return worker;
  }

  private post(req: FitRequest) {
    const worker = this.ensureWorker();
    if (!worker) return;
    this.busy = true;
    worker.postMessage(req, [
      req.coords.buffer,
      req.labels.buffer,
      req.ids.buffer,
      ...(req.evalCoords ? [req.evalCoords.buffer] : []),
      ...(req.evalLabels ? [req.evalLabels.buffer] : []),
      ...(req.evalIds ? [req.evalIds.buffer] : []),
    ]);
  }

  request(build: (id: number) => FitRequest): void {
    const id = nextId++;
    this.latestId = id;
    const req = build(id);
    if (!this.state.pending) this.emit({ ...this.state, pending: true });
    if (this.busy) this.queued = req;
    else this.post(req);
  }

  reset(): void {
    this.queued = null;
    this.latestId = nextId++;
    this.emit(EMPTY_FIT);
  }

  /**
   * Tear the worker down and return the runner to a usable state.
   *
   * Resetting `busy` and `queued` is not housekeeping — it is required for
   * correctness. Terminating the worker while a request was in flight means no
   * reply will ever arrive to clear `busy`, so the next request would queue
   * behind a worker that no longer exists and the surface would never appear.
   * React's StrictMode remounts every effect once in development, which makes
   * that deadlock the default rather than an edge case.
   *
   * Listeners are deliberately left alone: `subscribe` hands back its own
   * unsubscribe, and clearing the set here would strand live subscribers.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
    this.queued = null;
  }
}
