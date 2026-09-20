"use client";

import * as React from "react";
import { decodeDigits, type DigitData } from "@/lib/ml/digits";
import {
  DigitsRunner,
  EMPTY_DIGITS,
  type DigitsConfig,
  type DigitsState,
} from "@/lib/ml/worker/digits-runner";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type DataStatus = "loading" | "ready" | "error";

export interface DigitsLab {
  data: DigitData | null;
  status: DataStatus;
  state: DigitsState;
  runner: DigitsRunner;
}

/**
 * Load the digit images once, and keep a trained-on-demand network beside them.
 *
 * The images are fetched rather than bundled: 630 KB of pixels has no business
 * inside a JavaScript chunk that every other page would also pay for.
 */
export function useDigits(config: DigitsConfig): DigitsLab {
  const [runner] = React.useState(() => new DigitsRunner());
  const [data, setData] = React.useState<DigitData | null>(null);
  const [status, setStatus] = React.useState<DataStatus>("loading");

  React.useEffect(() => () => runner.dispose(), [runner]);

  React.useEffect(() => {
    let cancelled = false;
    // No setStatus("loading") here: the effect runs once, and the state already
    // starts there — a synchronous setState in an effect body only buys a
    // wasted render.
    fetch(`${BASE}/data/digits16.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const decoded = decodeDigits(buf);
        setData(decoded);
        setStatus("ready");
        // The worker gets its own copy; the page keeps these pixels to draw the
        // example gallery, so the buffer is deliberately not transferred.
        runner.setData(decoded.pixels, decoded.labels);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [runner]);

  const { hidden, activation, learningRate, trainCount, seed } = config;
  const hiddenKey = hidden.join("-");

  React.useEffect(() => {
    runner.build({
      hidden: hiddenKey ? hiddenKey.split("-").map(Number) : [],
      activation,
      learningRate,
      trainCount,
      seed,
    });
  }, [runner, hiddenKey, activation, learningRate, trainCount, seed]);

  const state = React.useSyncExternalStore(
    runner.subscribe,
    runner.getSnapshot,
    runner.getServerSnapshot,
  );

  return { data, status, state: status === "error" ? EMPTY_DIGITS : state, runner };
}
