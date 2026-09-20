"use client";

import * as React from "react";
import type { Sample } from "@/lib/ml/types";
import { sigmoid } from "@/lib/ml/models/logistic";
import { linearScale } from "@/lib/viz/geometry";
import { classColor, CHROME, STATUS, withAlpha } from "@/lib/viz/palette";

/**
 * The whole 2-D problem, collapsed onto the one number the model actually uses.
 *
 * A logistic model looks at exactly one quantity: the signed score
 * `z = w·x + b`. Everything else — which side of the line, how far, how
 * confident — is a consequence of that single number. Drawing the sigmoid with
 * every training point placed at its own `z` makes that visible: the classes
 * separate along the axis, the curve turns position into probability, and the
 * steepness of the curve (which is `‖w‖`) becomes something you can see rather
 * than a norm you are told about.
 */
export function SigmoidCurve({
  scored,
  selected,
  height = 190,
  onSelect,
}: {
  /**
   * Each training point with the score the *current* model gives it.
   *
   * Scores are passed in already computed rather than via a callback: a
   * callback closes over a mutable model, so a memo keyed on its identity keeps
   * returning the scores of an older set of weights — which here drew every
   * point stacked on z = 0 no matter how long the model trained.
   */
  scored: { sample: Sample; z: number }[];
  /** A sample to mark, with its score and probability spelled out. */
  selected?: Sample | null;
  height?: number;
  onSelect?: (s: Sample | null) => void;
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
  const pad = { l: 34, r: 12, t: 10, b: 30 };

  // The axis always shows at least ±5, so the curve keeps its recognisable S
  // even when the model is barely trained and every score sits near zero.
  const zMax = React.useMemo(() => {
    const m = scored.reduce((a, d) => Math.max(a, Math.abs(d.z)), 0);
    return Math.max(5, Math.min(14, m * 1.1));
  }, [scored]);

  const sx = linearScale([-zMax, zMax], [pad.l, w - pad.r]);
  const sy = linearScale([0, 1], [height - pad.b, pad.t]);

  const path = React.useMemo(() => {
    const N = 160;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const z = -zMax + (2 * zMax * i) / N;
      pts.push(`${sx(z).toFixed(1)},${sy(sigmoid(z)).toFixed(1)}`);
    }
    return `M ${pts.join(" L ")}`;
  }, [zMax, sx, sy]);

  const selZ = selected ? (scored.find((d) => d.sample.id === selected.id)?.z ?? null) : null;
  const selP = selZ === null ? null : sigmoid(selZ);

  return (
    <div ref={hostRef} className="w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="block w-full"
        role="img"
        aria-label="Courbe sigmoïde : score du modèle en abscisse, probabilité en ordonnée"
        onMouseLeave={() => onSelect?.(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1={pad.l}
              y1={sy(p)}
              x2={w - pad.r}
              y2={sy(p)}
              stroke={p === 0.5 ? CHROME.lineStrong : CHROME.line}
              strokeWidth={p === 0.5 ? 1 : 0.5}
              strokeDasharray={p === 0.5 ? "4 3" : undefined}
            />
            <text
              x={pad.l - 6}
              y={sy(p) + 3}
              textAnchor="end"
              fontSize={9}
              className="tnum"
              fill={CHROME.inkMuted}
            >
              {p === 0 || p === 1 ? p : p.toFixed(2)}
            </text>
          </g>
        ))}

        {/* z = 0: the decision threshold, the line drawn on the scatter plot. */}
        <line
          x1={sx(0)}
          y1={pad.t}
          x2={sx(0)}
          y2={height - pad.b}
          stroke={CHROME.lineStrong}
          strokeWidth={1}
        />
        <text
          x={sx(0)}
          y={height - pad.b + 20}
          textAnchor="middle"
          fontSize={9}
          fill={CHROME.inkMuted}
        >
          z = 0 — la frontière
        </text>

        <path d={path} fill="none" stroke={CHROME.accent} strokeWidth={2} />

        {/* Every training point at its own score: the rug. */}
        {scored.map(({ sample: s, z }) => {
          const x = sx(Math.max(-zMax, Math.min(zMax, z)));
          const y = s.y === 1 ? pad.t + 6 : height - pad.b - 6;
          const wrong = (z >= 0 ? 1 : 0) !== s.y;
          return (
            <circle
              key={s.id}
              cx={x}
              cy={y}
              r={wrong ? 3 : 2.2}
              fill={wrong ? "none" : withAlpha(classColor(s.y), 0.75)}
              stroke={wrong ? STATUS.critical : "none"}
              strokeWidth={1.2}
              onMouseEnter={() => onSelect?.(s)}
            />
          );
        })}

        {selZ !== null && selP !== null && (
          <g>
            <line
              x1={sx(selZ)}
              y1={height - pad.b}
              x2={sx(selZ)}
              y2={sy(selP)}
              stroke={CHROME.ink}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={pad.l}
              y1={sy(selP)}
              x2={sx(selZ)}
              y2={sy(selP)}
              stroke={CHROME.ink}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={sx(selZ)} cy={sy(selP)} r={4} fill={CHROME.ink} />
          </g>
        )}

        <text
          x={w - pad.r}
          y={height - pad.b + 20}
          textAnchor="end"
          fontSize={9}
          fill={CHROME.inkMuted}
        >
          score z
        </text>
      </svg>
      <p className="mt-1 text-[11px] leading-snug text-ink-2">
        {selZ !== null && selP !== null ? (
          <>
            Point survolé : score <strong className="tnum">{selZ.toFixed(2)}</strong> →
            probabilité <strong className="tnum">{(selP * 100).toFixed(1)} %</strong>{" "}
            d&apos;appartenir à la classe du haut.
          </>
        ) : (
          <>
            Chaque point du nuage est posé ici à son score. En haut ceux dont la vraie classe
            est la seconde, en bas la première ; un cercle rouge vide = le modèle se trompe.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Why being confidently wrong is expensive.
 *
 * The log-loss of one point is `−log(p)` where `p` is the probability the model
 * gave to the *correct* answer. Plotting it shows the asymmetry that no verbal
 * description conveys: a model that says 50 % pays 0.69, one that says 1 % pays
 * 4.6, and one that says 0 % pays infinity. That shape is the entire reason
 * classifiers are trained on this loss rather than on their error count.
 */
export function LogLossCurve({
  probability,
  height = 150,
}: {
  /** Probability currently assigned to the true class, marked on the curve. */
  probability: number | null;
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

  const w = width ?? 340;
  const pad = { l: 28, r: 10, t: 10, b: 26 };
  const maxLoss = 4.6; // −log(0.01): beyond that the curve is a vertical wall.
  const sx = linearScale([0, 1], [pad.l, w - pad.r]);
  const sy = linearScale([0, maxLoss], [height - pad.b, pad.t]);

  const path = React.useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const p = 0.01 + (0.99 * i) / 120;
      pts.push(`${sx(p).toFixed(1)},${sy(Math.min(maxLoss, -Math.log(p))).toFixed(1)}`);
    }
    return `M ${pts.join(" L ")}`;
  }, [sx, sy]);

  const loss = probability === null ? null : -Math.log(Math.max(probability, 1e-6));

  return (
    <div ref={hostRef} className="w-full">
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="block w-full"
        role="img"
        aria-label="Coût d'un point en fonction de la probabilité donnée à la bonne réponse"
      >
        {[0, 1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              y1={sy(v)}
              x2={w - pad.r}
              y2={sy(v)}
              stroke={CHROME.line}
              strokeWidth={0.5}
            />
            <text
              x={pad.l - 5}
              y={sy(v) + 3}
              textAnchor="end"
              fontSize={9}
              className="tnum"
              fill={CHROME.inkMuted}
            >
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke={STATUS.warning} strokeWidth={2} />
        {loss !== null && (
          <g>
            <circle
              cx={sx(Math.max(0.01, probability ?? 0.01))}
              cy={sy(Math.min(maxLoss, loss))}
              r={4}
              fill={CHROME.ink}
            />
            <line
              x1={sx(Math.max(0.01, probability ?? 0.01))}
              y1={sy(Math.min(maxLoss, loss))}
              x2={sx(Math.max(0.01, probability ?? 0.01))}
              y2={height - pad.b}
              stroke={CHROME.ink}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </g>
        )}
        {[0, 0.5, 1].map((p) => (
          <text
            key={p}
            x={sx(p)}
            y={height - pad.b + 14}
            textAnchor={p === 0 ? "start" : p === 1 ? "end" : "middle"}
            fontSize={9}
            className="tnum"
            fill={CHROME.inkMuted}
          >
            {p}
          </text>
        ))}
        <text
          x={w - pad.r}
          y={height - pad.b + 24}
          textAnchor="end"
          fontSize={9}
          fill={CHROME.inkMuted}
        >
          probabilité donnée à la bonne réponse
        </text>
      </svg>
    </div>
  );
}
