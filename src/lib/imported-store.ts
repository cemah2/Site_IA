import type { Dataset } from "./ml/types";

/**
 * Keep an imported dataset across page loads.
 *
 * Without this, a reader who imports a file and then refreshes — or opens a
 * page in a second tab — silently gets the generated data back, with no way to
 * tell that anything was lost. The data stays on the machine either way: this
 * is the browser's own storage, not a server.
 *
 * Every access is wrapped: storage throws in a private window, and a quota
 * error on a large file must cost the reader a persisted copy, never the page.
 */
const KEY = "mllab.imported";
const MAX_BYTES = 1_500_000;

export function saveImported(dataset: Dataset): void {
  try {
    const payload = JSON.stringify({
      name: dataset.name,
      featureNames: dataset.featureNames,
      classNames: dataset.classNames,
      domain: dataset.domain,
      // Coordinates rounded to six significant digits: the extra precision is
      // noise from a file that had four, and it doubles the stored size.
      samples: dataset.samples.map((s) => [
        Number(s.x[0].toPrecision(6)),
        Number(s.x[1].toPrecision(6)),
        s.y,
      ]),
    });
    if (payload.length > MAX_BYTES) return;
    window.localStorage.setItem(KEY, payload);
  } catch {
    // Storage unavailable or full — the session still works, it just will not
    // survive a reload.
  }
}

export function clearImported(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Restore, validating hard: this is data the page itself wrote, but a browser
 *  profile can be old, edited or shared with a different version of the site. */
export function loadImported(): Dataset | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const d = parsed as Record<string, unknown>;
    const samples = d.samples;
    const featureNames = d.featureNames;
    const classNames = d.classNames;
    const domain = d.domain;
    if (
      !Array.isArray(samples) ||
      !Array.isArray(featureNames) ||
      !Array.isArray(classNames) ||
      !Array.isArray(domain) ||
      featureNames.length !== 2 ||
      domain.length !== 2 ||
      !classNames.length ||
      samples.length < 4
    ) {
      return null;
    }
    const out: Dataset = {
      name: typeof d.name === "string" ? d.name : "vos données",
      featureNames: featureNames.map(String).slice(0, 2),
      classNames: classNames.map(String),
      domain: domain.map((r) => {
        const pair = r as unknown[];
        return [Number(pair?.[0]), Number(pair?.[1])] as [number, number];
      }) as [number, number][],
      samples: [],
    };
    if (out.domain.some((r) => !Number.isFinite(r[0]) || !Number.isFinite(r[1]))) return null;

    for (let i = 0; i < samples.length; i++) {
      const row = samples[i] as unknown[];
      const x = Number(row?.[0]);
      const y = Number(row?.[1]);
      const label = Number(row?.[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      out.samples.push({
        id: i,
        x: [x, y],
        y: Number.isInteger(label) && label >= 0 && label < out.classNames.length ? label : 0,
      });
    }
    return out;
  } catch {
    return null;
  }
}
