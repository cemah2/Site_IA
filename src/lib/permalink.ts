import type { DatasetId } from "@/lib/ml/datasets";

/**
 * Shareable links.
 *
 * The state lives in the URL **fragment**, not the query string. The site is a
 * static export served from a plain file host: a query string would still work
 * but would be sent to the server and end up in its logs, and — more to the
 * point — a fragment can be rewritten with `replaceState` without the router
 * treating it as a navigation.
 *
 * Only what a reader would want to hand to someone else is encoded: the
 * problem (which dataset, how many points, how noisy, which draw) plus whatever
 * the page considers its own settings. Nothing is stored that could identify
 * anyone, because nothing about a reader exists here in the first place.
 */

export interface DatasetParams {
  kind: DatasetId;
  n: number;
  noise: number;
  seed: number;
  nClasses: number;
  trainRatio: number;
}

/** Short keys: a link that fits in a message is a link that gets sent. */
const DATASET_KEYS: Record<keyof DatasetParams, string> = {
  kind: "d",
  n: "n",
  noise: "z",
  seed: "s",
  nClasses: "c",
  trainRatio: "r",
};

export type ShareValue = string | number | boolean | undefined | null;

export function encodeParams(
  dataset: DatasetParams,
  extra: Record<string, ShareValue> = {},
): string {
  const p = new URLSearchParams();
  for (const [field, key] of Object.entries(DATASET_KEYS)) {
    const v = dataset[field as keyof DatasetParams];
    p.set(key, typeof v === "number" ? trim(v) : String(v));
  }
  for (const [key, v] of Object.entries(extra)) {
    if (v === undefined || v === null) continue;
    p.set(key, typeof v === "number" ? trim(v) : String(v));
  }
  return p.toString();
}

/** Drop trailing zeros so `0.18` stays `0.18` and `160` stays `160`. */
function trim(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

export function readHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw);
}

/**
 * Dataset settings from the current URL, ignoring anything malformed.
 *
 * A link is untrusted input: it arrives from a chat message and may have been
 * truncated or edited. Every field is range-checked, and a bad one is simply
 * dropped rather than throwing — a broken parameter should cost the reader a
 * default value, never a blank page.
 */
export function decodeDatasetParams(
  params: URLSearchParams,
  valid: readonly string[],
): Partial<DatasetParams> {
  const out: Partial<DatasetParams> = {};
  const kind = params.get(DATASET_KEYS.kind);
  if (kind && valid.includes(kind)) out.kind = kind as DatasetId;

  const num = (key: string, lo: number, hi: number): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const v = Number(raw);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
  };

  // Snapped to the steps the sliders use. Without this, a link carrying
  // noise = 0.35 leaves the store at 0.35 while the slider displays 0.36 — and
  // the first touch of the control makes the value jump for no visible reason.
  const snap = (v: number, step: number) => Math.round(v / step) * step;

  const n = num(DATASET_KEYS.n, 10, 1000);
  if (n !== undefined) out.n = snap(n, 10);
  const noise = num(DATASET_KEYS.noise, 0, 1);
  if (noise !== undefined) out.noise = Math.round(snap(noise, 0.02) * 100) / 100;
  const seed = num(DATASET_KEYS.seed, 0, 1e9);
  if (seed !== undefined) out.seed = Math.round(seed);
  const nClasses = num(DATASET_KEYS.nClasses, 2, 5);
  if (nClasses !== undefined) out.nClasses = Math.round(nClasses);
  const trainRatio = num(DATASET_KEYS.trainRatio, 0.1, 0.95);
  if (trainRatio !== undefined) out.trainRatio = Math.round(snap(trainRatio, 0.05) * 100) / 100;

  return out;
}

/** A page setting from the link, with the same "never throw" contract. */
export function sharedNumber(
  params: URLSearchParams,
  key: string,
  lo: number,
  hi: number,
): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
}

export function sharedChoice<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = params.get(key);
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

export function shareUrl(hash: string): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${hash}`;
}
