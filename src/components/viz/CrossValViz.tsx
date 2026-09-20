"use client";

import * as React from "react";
import type { CvResult, SweepPoint } from "@/lib/ml/crossval";
import { linearScale } from "@/lib/viz/geometry";
import { CHROME, SERIES, STATUS, withAlpha } from "@/lib/viz/palette";

/**
 * Who is tested when: one row per fold, one cell per sample.
 *
 * The diagram is the definition. "Each block takes a turn as the test set"
 * takes a paragraph to write and one glance to see, and hovering a row puts the
 * same points back on the scatter plot beside it, so the abstraction stays
 * attached to the data it is about.
 */
export function FoldDiagram({
  assignment,
  k,
  results,
  active,
  onHover,
  height = 18,
}: {
  /** Fold index for each sample, in dataset order. */
  assignment: number[];
  k: number;
  results?: { fold: number; testAccuracy: number; testSize: number }[];
  active?: number | null;
  onHover?: (fold: number | null) => void;
  height?: number;
}) {
  const n = assignment.length || 1;

  // Displayed grouped by fold rather than in dataset order. The underlying
  // assignment is round-robin, so drawing it raw produces one-pixel stripes
  // that read as static; grouped, it is the block diagram the idea deserves —
  // and the horizontal axis here means "the shuffled dataset", not an order
  // anything depends on.
  const order = React.useMemo(
    () =>
      assignment
        .map((fold, i) => ({ fold, i }))
        .sort((a, b) => a.fold - b.fold || a.i - b.i)
        .map((d) => d.fold),
    [assignment],
  );

  return (
    <div className="space-y-1" onMouseLeave={() => onHover?.(null)}>
      {Array.from({ length: k }, (_, f) => {
        const res = results?.find((r) => r.fold === f);
        return (
          <div
            key={f}
            className="flex items-center gap-2"
            onMouseEnter={() => onHover?.(f)}
          >
            <span className="tnum w-12 shrink-0 text-right text-[10.5px] text-ink-muted">
              pli {f + 1}
            </span>
            <svg
              width="100%"
              height={height}
              viewBox={`0 0 ${n} ${height}`}
              preserveAspectRatio="none"
              className="flex-1 rounded-[3px]"
              role="img"
              aria-label={`Pli ${f + 1} : ${res?.testSize ?? 0} points de test`}
              style={{ opacity: active === null || active === undefined || active === f ? 1 : 0.4 }}
            >
              {order.map((a, i) => (
                <rect
                  key={i}
                  x={i}
                  y={0}
                  width={1}
                  height={height}
                  fill={a === f ? SERIES[1] : withAlpha(SERIES[0], 0.35)}
                />
              ))}
            </svg>
            <span className="tnum w-12 shrink-0 text-right text-[10.5px] text-ink-2">
              {res ? `${(res.testAccuracy * 100).toFixed(0)} %` : "—"}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-1 text-[10.5px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-[2px]"
            style={{ background: withAlpha(SERIES[0], 0.35) }}
          />
          entraînement
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-[2px]"
            style={{ background: SERIES[1] }}
          />
          test de ce pli
        </span>
      </div>
    </div>
  );
}

/**
 * Every accuracy a single random split could have handed you.
 *
 * The page's opening claim is that one train/test split reports a number with
 * several points of luck in it. Stating that is unconvincing; drawing forty
 * draws of the same experiment, with the spread between the extremes labelled,
 * is not.
 */
export function SplitLottery({
  draws,
  cvMean,
  height = 110,
}: {
  /** Test accuracies obtained from repeated random splits. */
  draws: number[];
  /** The cross-validated estimate, drawn as the reference line. */
  cvMean?: number | null;
  height?: number;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? 420;
  const pad = { l: 8, r: 8, t: 14, b: 26 };

  const lo = draws.length ? Math.min(...draws) : 0;
  const hi = draws.length ? Math.max(...draws) : 1;
  const domain: [number, number] = [
    Math.max(0, Math.min(lo, cvMean ?? lo) - 0.06),
    Math.min(1, Math.max(hi, cvMean ?? hi) + 0.06),
  ];
  const sx = linearScale(domain, [pad.l, w - pad.r]);
  const baseY = height - pad.b;

  // Dots are stacked where they collide, so twenty identical results read as a
  // tall column rather than as one dot.
  const placed = React.useMemo(() => {
    const buckets = new Map<number, number>();
    return draws.map((v) => {
      const key = Math.round(sx(v) / 6);
      const level = buckets.get(key) ?? 0;
      buckets.set(key, level + 1);
      return { v, level };
    });
  }, [draws, sx]);

  return (
    <div ref={hostRef} className="w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="block w-full"
        role="img"
        aria-label="Accuracy obtenue par chaque tirage aléatoire du découpage"
      >
        <line
          x1={pad.l}
          y1={baseY}
          x2={w - pad.r}
          y2={baseY}
          stroke={CHROME.line}
          strokeWidth={1}
        />
        {draws.length > 1 && (
          <>
            <rect
              x={sx(lo)}
              y={baseY - 4}
              width={Math.max(1, sx(hi) - sx(lo))}
              height={8}
              fill={withAlpha(STATUS.warning, 0.18)}
            />
            {[lo, hi].map((v, i) => (
              <g key={i}>
                <line
                  x1={sx(v)}
                  y1={baseY - 8}
                  x2={sx(v)}
                  y2={baseY + 6}
                  stroke={STATUS.warning}
                  strokeWidth={1.2}
                />
                <text
                  x={sx(v)}
                  y={height - 6}
                  textAnchor={i === 0 ? "start" : "end"}
                  fontSize={10}
                  className="tnum"
                  fill={STATUS.warning}
                >
                  {(v * 100).toFixed(1)} %
                </text>
              </g>
            ))}
          </>
        )}
        {placed.map(({ v, level }, i) => (
          <circle
            key={i}
            cx={sx(v)}
            cy={baseY - 8 - level * 6}
            r={2.6}
            fill={withAlpha(SERIES[0], 0.85)}
          />
        ))}
        {cvMean !== null && cvMean !== undefined && (
          <g>
            <line
              x1={sx(cvMean)}
              y1={pad.t - 6}
              x2={sx(cvMean)}
              y2={baseY + 6}
              stroke={STATUS.good}
              strokeWidth={1.6}
            />
            <text
              x={sx(cvMean)}
              y={pad.t - 1}
              textAnchor="middle"
              fontSize={10}
              className="tnum"
              fill={STATUS.good}
            >
              validation croisée {(cvMean * 100).toFixed(1)} %
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * A hyperparameter sweep scored two ways.
 *
 * The band is the fold-to-fold min–max, not a standard error: it answers "how
 * differently could this have turned out", which is the question a learner
 * actually has. The two argmax markers are the payload — when they disagree,
 * the single split has just recommended the wrong setting.
 */
export function SweepChart({
  points,
  label,
  height = 210,
  onHover,
  active,
}: {
  points: SweepPoint[];
  /** Name of the swept hyperparameter, for the axis. */
  label: string;
  height?: number;
  onHover?: (index: number | null) => void;
  active?: number | null;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? 460;
  const pad = { l: 42, r: 12, t: 12, b: 38 };
  const n = points.length;

  const lo = Math.min(...points.map((p) => Math.min(p.cv.min, p.single)), 1);
  const hi = Math.max(...points.map((p) => Math.max(p.cv.max, p.single)), 0);
  const yDom: [number, number] = [Math.max(0, lo - 0.04), Math.min(1, hi + 0.04)];

  // Positions are by rank, not by value: sweeps like k = 1, 2, 3, 5, 9, 20 are
  // read as an ordered list of candidates, and a value axis would squash the
  // interesting small values into the left edge.
  const sx = (i: number) =>
    n <= 1 ? (pad.l + w - pad.r) / 2 : pad.l + ((w - pad.r - pad.l) * i) / (n - 1);
  const sy = linearScale(yDom, [height - pad.b, pad.t]);

  const bestCv = points.reduce((b, p, i) => (p.cv.mean > points[b].cv.mean ? i : b), 0);
  const bestSingle = points.reduce((b, p, i) => (p.single > points[b].single ? i : b), 0);

  const line = (get: (p: SweepPoint) => number) =>
    `M ${points.map((p, i) => `${sx(i).toFixed(1)},${sy(get(p)).toFixed(1)}`).join(" L ")}`;

  const band = `M ${points
    .map((p, i) => `${sx(i).toFixed(1)},${sy(p.cv.max).toFixed(1)}`)
    .join(" L ")} L ${points
    .slice()
    .reverse()
    .map((p, j) => `${sx(n - 1 - j).toFixed(1)},${sy(p.cv.min).toFixed(1)}`)
    .join(" L ")} Z`;

  return (
    <div ref={hostRef} className="w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="block w-full"
        role="img"
        aria-label={`Accuracy selon ${label}, mesurée par validation croisée et par un seul découpage`}
        onMouseLeave={() => onHover?.(null)}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const v = yDom[0] + ((yDom[1] - yDom[0]) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                y1={sy(v)}
                x2={w - pad.r}
                y2={sy(v)}
                stroke={CHROME.line}
                strokeWidth={0.5}
              />
              <text
                x={pad.l - 6}
                y={sy(v) + 3}
                textAnchor="end"
                fontSize={9}
                className="tnum"
                fill={CHROME.inkMuted}
              >
                {(v * 100).toFixed(0)} %
              </text>
            </g>
          );
        })}

        <path d={band} fill={withAlpha(SERIES[0], 0.14)} stroke="none" />
        <path d={line((p) => p.single)} fill="none" stroke={SERIES[1]} strokeWidth={1.4} strokeDasharray="5 4" />
        <path d={line((p) => p.cv.mean)} fill="none" stroke={SERIES[0]} strokeWidth={2} />

        {points.map((p, i) => (
          <g key={p.value}>
            <circle cx={sx(i)} cy={sy(p.cv.mean)} r={active === i ? 4 : 2.6} fill={SERIES[0]} />
            <circle cx={sx(i)} cy={sy(p.single)} r={active === i ? 3.5 : 2.2} fill={SERIES[1]} />
            <rect
              x={sx(i) - (w - pad.l - pad.r) / (2 * Math.max(1, n - 1))}
              y={pad.t}
              width={(w - pad.l - pad.r) / Math.max(1, n - 1)}
              height={height - pad.t - pad.b}
              fill="transparent"
              onMouseEnter={() => onHover?.(i)}
            />
            <text
              x={sx(i)}
              y={height - pad.b + 13}
              textAnchor="middle"
              fontSize={9}
              className="tnum"
              fill={active === i ? CHROME.ink : CHROME.inkMuted}
            >
              {p.value}
            </text>
          </g>
        ))}

        {[
          { i: bestCv, colour: SERIES[0], text: "meilleur en VC" },
          { i: bestSingle, colour: SERIES[1], text: "meilleur au tirage unique" },
        ].map(({ i, colour, text }, j) => (
          <g key={text}>
            <line
              x1={sx(i)}
              y1={pad.t}
              x2={sx(i)}
              y2={height - pad.b}
              stroke={colour}
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.7}
            />
            <text
              x={sx(i)}
              y={pad.t + 10 + j * 11}
              textAnchor={i > n / 2 ? "end" : "start"}
              fontSize={9}
              fill={colour}
              dx={i > n / 2 ? -4 : 4}
            >
              {text}
            </text>
          </g>
        ))}

        <text
          x={(pad.l + w - pad.r) / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize={9}
          fill={CHROME.inkMuted}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

/** Mean ± spread, written the way a paper would write it. */
export function CvSummary({ cv }: { cv: CvResult }) {
  return (
    <span className="tnum">
      {(cv.mean * 100).toFixed(1)} % ± {(cv.std * 100).toFixed(1)}
    </span>
  );
}
