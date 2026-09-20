"use client";

import * as React from "react";
import type { CurvePoint, ScoredSample, ThresholdMetrics } from "@/lib/ml/threshold";
import { linearScale } from "@/lib/viz/geometry";
import { classColor, CHROME, STATUS, withAlpha } from "@/lib/viz/palette";

/**
 * The picture the whole idea rests on: where the two classes land on the score
 * axis, and where you cut.
 *
 * A model's output is not a class, it is a position on this line. If the two
 * humps were separated there would be no decision to make; they overlap, and
 * every possible cut trades one kind of mistake for the other. Dragging the
 * line makes that trade something you do rather than something you are told.
 */
export function ScoreStrip({
  scored,
  threshold,
  onThreshold,
  classNames,
  height = 190,
  bins = 34,
}: {
  scored: ScoredSample[];
  threshold: number;
  onThreshold?: (t: number) => void;
  classNames: string[];
  height?: number;
  bins?: number;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);
  const dragging = React.useRef(false);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? 480;
  const pad = { l: 10, r: 10, t: 12, b: 30 };
  const mid = (height - pad.b + pad.t) / 2;

  const histogram = React.useMemo(() => {
    const pos = new Array<number>(bins).fill(0);
    const neg = new Array<number>(bins).fill(0);
    for (const s of scored) {
      const b = Math.min(bins - 1, Math.max(0, Math.floor(s.score * bins)));
      (s.label === 1 ? pos : neg)[b] += 1;
    }
    const peak = Math.max(1, ...pos, ...neg);
    return { pos, neg, peak };
  }, [scored, bins]);

  const sx = linearScale([0, 1], [pad.l, w - pad.r]);
  const barW = (w - pad.l - pad.r) / bins;
  const barH = (count: number) => (count / histogram.peak) * (mid - pad.t - 4);

  const pick = (clientX: number, el: SVGSVGElement) => {
    if (!onThreshold) return;
    const rect = el.getBoundingClientRect();
    const t = (clientX - rect.left - pad.l) / (w - pad.l - pad.r);
    onThreshold(Math.min(1, Math.max(0, t)));
  };

  return (
    <div ref={hostRef} className="w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="block w-full touch-none select-none"
        style={{ cursor: onThreshold ? "ew-resize" : undefined }}
        role="img"
        aria-label="Répartition des scores du modèle par classe, avec le seuil de décision"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (dragging.current) pick(e.clientX, e.currentTarget);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {/* Everything left of the line is answered "negative", everything
            right "positive" — shading it removes any doubt about which is which. */}
        <rect
          x={pad.l}
          y={pad.t}
          width={Math.max(0, sx(threshold) - pad.l)}
          height={height - pad.b - pad.t}
          fill={withAlpha(classColor(0), 0.07)}
        />
        <rect
          x={sx(threshold)}
          y={pad.t}
          width={Math.max(0, w - pad.r - sx(threshold))}
          height={height - pad.b - pad.t}
          fill={withAlpha(classColor(1), 0.07)}
        />

        <line x1={pad.l} y1={mid} x2={w - pad.r} y2={mid} stroke={CHROME.line} strokeWidth={1} />

        {histogram.pos.map((count, i) =>
          count ? (
            <rect
              key={`p${i}`}
              x={pad.l + i * barW + 0.5}
              y={mid - barH(count)}
              width={Math.max(1, barW - 1)}
              height={barH(count)}
              fill={classColor(1)}
              opacity={0.85}
            />
          ) : null,
        )}
        {histogram.neg.map((count, i) =>
          count ? (
            <rect
              key={`n${i}`}
              x={pad.l + i * barW + 0.5}
              y={mid}
              width={Math.max(1, barW - 1)}
              height={barH(count)}
              fill={classColor(0)}
              opacity={0.85}
            />
          ) : null,
        )}

        <line
          x1={sx(threshold)}
          y1={pad.t - 4}
          x2={sx(threshold)}
          y2={height - pad.b + 4}
          stroke={CHROME.ink}
          strokeWidth={2}
        />
        <circle cx={sx(threshold)} cy={pad.t - 4} r={5} fill={CHROME.ink} />
        {/* The value rides with the handle at the top. On the baseline it
            collided with the axis captions whenever the cut sat near an edge. */}
        <text
          x={sx(threshold) + (threshold > 0.5 ? -10 : 10)}
          y={pad.t + 2}
          textAnchor={threshold > 0.5 ? "end" : "start"}
          fontSize={11}
          className="tnum"
          fontWeight={600}
          fill={CHROME.ink}
        >
          {threshold.toFixed(2)}
        </text>

        <text x={pad.l} y={height - 8} fontSize={10} fill={CHROME.inkMuted}>
          score 0 — « sûrement {classNames[0] ?? "négatif"} »
        </text>
        <text x={w - pad.r} y={height - 8} textAnchor="end" fontSize={10} fill={CHROME.inkMuted}>
          « sûrement {classNames[1] ?? "positif"} » — 1
        </text>

      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-[2px]"
            style={{ background: classColor(1) }}
          />
          vrais {classNames[1] ?? "positifs"} (au-dessus)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-[2px]"
            style={{ background: classColor(0) }}
          />
          vrais {classNames[0] ?? "négatifs"} (en dessous)
        </span>
      </div>
    </div>
  );
}

/**
 * ROC, with the current cut marked.
 *
 * The curve is the model; the point is your decision. Keeping both on screen is
 * what stops "AUC = 0,92" from being mistaken for a description of how the
 * model will behave once someone has to act on it.
 */
export function RocCurve({
  points,
  current,
  aucValue,
  size = 260,
  onPick,
}: {
  points: CurvePoint[];
  current: ThresholdMetrics;
  aucValue: number;
  size?: number;
  onPick?: (threshold: number) => void;
}) {
  const pad = { l: 34, r: 10, t: 10, b: 30 };
  const sx = linearScale([0, 1], [pad.l, size - pad.r]);
  const sy = linearScale([0, 1], [size - pad.b, pad.t]);

  const path = points.length
    ? `M ${points.map((p) => `${sx(p.fpr).toFixed(1)},${sy(p.tpr).toFixed(1)}`).join(" L ")}`
    : "";
  const area = points.length
    ? `${path} L ${sx(1).toFixed(1)},${sy(0).toFixed(1)} L ${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`
    : "";

  return (
    <div>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block max-w-full"
        role="img"
        aria-label={`Courbe ROC, aire sous la courbe ${aucValue.toFixed(3)}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={pad.t} x2={sx(v)} y2={size - pad.b} stroke={CHROME.line} strokeWidth={0.5} />
            <line x1={pad.l} y1={sy(v)} x2={size - pad.r} y2={sy(v)} stroke={CHROME.line} strokeWidth={0.5} />
          </g>
        ))}
        {area && <path d={area} fill={withAlpha(CHROME.accent, 0.12)} />}
        {/* The diagonal is the model that has learned nothing: guessing with
            the right base rate lands exactly here. */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(1)}
          stroke={CHROME.lineStrong}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {path && <path d={path} fill="none" stroke={CHROME.accent} strokeWidth={2} />}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.fpr)}
            cy={sy(p.tpr)}
            r={7}
            fill="transparent"
            style={{ cursor: onPick ? "pointer" : undefined }}
            onClick={() => onPick?.(p.threshold)}
          />
        ))}
        <circle cx={sx(current.fpr)} cy={sy(current.recall)} r={5} fill={CHROME.ink} stroke={CHROME.surface1} strokeWidth={2} />
        <text x={pad.l - 6} y={sy(1) + 3} textAnchor="end" fontSize={9} fill={CHROME.inkMuted}>1</text>
        <text x={pad.l - 6} y={sy(0) + 3} textAnchor="end" fontSize={9} fill={CHROME.inkMuted}>0</text>
        <text x={(pad.l + size - pad.r) / 2} y={size - 8} textAnchor="middle" fontSize={9} fill={CHROME.inkMuted}>
          faux positifs (sur les vrais négatifs)
        </text>
        <text
          x={12}
          y={(pad.t + size - pad.b) / 2}
          textAnchor="middle"
          fontSize={9}
          fill={CHROME.inkMuted}
          transform={`rotate(-90 12 ${(pad.t + size - pad.b) / 2})`}
        >
          rappel
        </text>
      </svg>
    </div>
  );
}

/** Precision against recall, which is what an imbalanced problem is judged on. */
export function PrCurve({
  points,
  current,
  baseline,
  size = 260,
  onPick,
}: {
  points: CurvePoint[];
  current: ThresholdMetrics;
  /** Share of positives — the precision a coin flip would reach. */
  baseline: number;
  size?: number;
  onPick?: (threshold: number) => void;
}) {
  const pad = { l: 34, r: 10, t: 10, b: 30 };
  const sx = linearScale([0, 1], [pad.l, size - pad.r]);
  const sy = linearScale([0, 1], [size - pad.b, pad.t]);
  const usable = points.filter((p) => p.recall > 0);
  const path = usable.length
    ? `M ${usable.map((p) => `${sx(p.recall).toFixed(1)},${sy(p.precision).toFixed(1)}`).join(" L ")}`
    : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block max-w-full"
      role="img"
      aria-label="Courbe précision–rappel"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={pad.t} x2={sx(v)} y2={size - pad.b} stroke={CHROME.line} strokeWidth={0.5} />
          <line x1={pad.l} y1={sy(v)} x2={size - pad.r} y2={sy(v)} stroke={CHROME.line} strokeWidth={0.5} />
        </g>
      ))}
      <line
        x1={sx(0)}
        y1={sy(baseline)}
        x2={sx(1)}
        y2={sy(baseline)}
        stroke={STATUS.warning}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text x={size - pad.r} y={sy(baseline) - 4} textAnchor="end" fontSize={9} fill={STATUS.warning}>
        hasard ({(baseline * 100).toFixed(0)} %)
      </text>
      {path && <path d={path} fill="none" stroke={CHROME.accent} strokeWidth={2} />}
      {usable.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.recall)}
          cy={sy(p.precision)}
          r={7}
          fill="transparent"
          style={{ cursor: onPick ? "pointer" : undefined }}
          onClick={() => onPick?.(p.threshold)}
        />
      ))}
      <circle cx={sx(current.recall)} cy={sy(current.precision)} r={5} fill={CHROME.ink} stroke={CHROME.surface1} strokeWidth={2} />
      <text x={(pad.l + size - pad.r) / 2} y={size - 8} textAnchor="middle" fontSize={9} fill={CHROME.inkMuted}>
        rappel
      </text>
      <text
        x={12}
        y={(pad.t + size - pad.b) / 2}
        textAnchor="middle"
        fontSize={9}
        fill={CHROME.inkMuted}
        transform={`rotate(-90 12 ${(pad.t + size - pad.b) / 2})`}
      >
        précision
      </text>
    </svg>
  );
}

/** The four outcomes as four blocks, sized by count. */
export function ConfusionBlocks({
  m,
  classNames,
}: {
  m: ThresholdMetrics;
  classNames: string[];
}) {
  const cells = [
    { key: "tp", n: m.tp, label: `Vrais ${classNames[1]}`, hint: "détectés, à juste titre", tone: STATUS.good },
    { key: "fp", n: m.fp, label: "Fausses alertes", hint: `des ${classNames[0]} signalés à tort`, tone: STATUS.warning },
    { key: "fn", n: m.fn, label: "Manqués", hint: `des ${classNames[1]} laissés passer`, tone: STATUS.critical },
    { key: "tn", n: m.tn, label: `Vrais ${classNames[0]}`, hint: "laissés tranquilles, à juste titre", tone: CHROME.lineStrong },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div
          key={c.key}
          className="rounded-lg border px-3 py-2.5"
          style={{ borderColor: withAlpha(c.tone, 0.45), background: withAlpha(c.tone, 0.07) }}
        >
          <div className="tnum text-[20px] font-semibold leading-none" style={{ color: c.tone }}>
            {c.n}
          </div>
          <div className="mt-1 text-[11px] font-medium text-ink">{c.label}</div>
          <div className="text-[10.5px] leading-snug text-ink-muted">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
