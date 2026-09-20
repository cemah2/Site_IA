"use client";

import * as React from "react";
import type { BackwardTrace, ForwardTrace, NeuralNet } from "@/lib/ml/models/neural-net";
import { CHROME, DIVERGING, rampAt, SEQUENTIAL, classColor } from "@/lib/viz/palette";

export interface NeuronRef {
  /** -1 = input layer; 0..n-1 = weight layers (hidden then output). */
  layer: number;
  index: number;
}

export type NetworkMode = "weights" | "activations" | "gradients";

/**
 * The network as a graph.
 *
 * Encoding choices, all load-bearing:
 *  - A weight is a SIGNED quantity, so connections use the diverging ramp
 *    (blue positive ↔ red negative) with thickness for magnitude. A sequential
 *    ramp here would make "strongly negative" look like "near zero".
 *  - An activation is a magnitude, so neuron fill uses the single-hue
 *    sequential ramp.
 *  - Gradients are signed too, and get the same diverging treatment as weights,
 *    which is what makes "this weight will go up, that one down" readable.
 */
export function NetworkDiagram({
  net,
  trace,
  grad,
  mode = "weights",
  progress,
  selected,
  onSelect,
  classNames,
  height = 300,
  showValues = true,
}: {
  net: NeuralNet;
  trace?: ForwardTrace | null;
  grad?: BackwardTrace | null;
  mode?: NetworkMode;
  /** Forward animation front, in layer units. Layers beyond it are not yet lit. */
  progress?: number;
  selected?: NeuronRef | null;
  onSelect?: (ref: NeuronRef | null) => void;
  classNames?: string[];
  height?: number;
  showValues?: boolean;
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

  const w = width ?? 560;
  const pad = { x: 54, y: 30 };
  const cols = net.sizes.length;
  const colX = (l: number) => pad.x + ((w - pad.x * 2) * l) / Math.max(1, cols - 1);
  const rowY = (l: number, i: number) => {
    const n = net.sizes[l];
    const usable = height - pad.y * 2;
    return n === 1 ? height / 2 : pad.y + (usable * i) / (n - 1);
  };

  const radius = Math.min(15, Math.max(8, (height - pad.y * 2) / (Math.max(...net.sizes) * 2.6)));

  const maxW = Math.max(
    1e-6,
    ...net.W.flatMap((layer) => layer.flatMap((row) => row.map(Math.abs))),
  );
  const maxG = grad
    ? Math.max(1e-9, ...grad.gradW.flatMap((l) => l.flatMap((r) => r.map(Math.abs))))
    : 1;

  const front = progress ?? cols;

  const activationOf = (l: number, i: number): number | null => {
    if (!trace) return null;
    if (l === 0) return trace.input[i] ?? null;
    return trace.layers[l - 1]?.a[i] ?? null;
  };

  // Activations are unbounded for ReLU; normalise per layer so the fill means
  // "strong relative to this layer" rather than saturating everywhere.
  const layerScale = React.useMemo(() => {
    if (!trace) return null;
    return [trace.input, ...trace.layers.map((l) => l.a)].map((vals) =>
      Math.max(1e-6, ...vals.map(Math.abs)),
    );
  }, [trace]);

  return (
    <div ref={hostRef} className="w-full">
      {width !== null && (
        <svg
          width={w}
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          className="block"
          role="img"
          aria-label={`Réseau ${net.sizes.join("-")}`}
        >
          {/* Connections */}
          {net.W.map((layer, l) =>
            layer.map((row, j) =>
              row.map((weight, i) => {
                const lit = front > l;
                const value =
                  mode === "gradients" && grad ? grad.gradW[l]?.[j]?.[i] ?? 0 : weight;
                const scale = mode === "gradients" && grad ? maxG : maxW;
                const t = Math.max(-1, Math.min(1, value / scale));
                const color = rampAt(DIVERGING, (t + 1) / 2);
                const isSel =
                  selected &&
                  ((selected.layer === l && selected.index === j) ||
                    (selected.layer === l - 1 && selected.index === i) ||
                    (selected.layer === -1 && l === 0 && selected.index === i));
                return (
                  <line
                    key={`${l}-${j}-${i}`}
                    x1={colX(l)}
                    y1={rowY(l, i)}
                    x2={colX(l + 1)}
                    y2={rowY(l + 1, j)}
                    stroke={color}
                    strokeWidth={0.5 + Math.abs(t) * 3}
                    opacity={
                      (lit ? 1 : 0.15) * (selected ? (isSel ? 1 : 0.18) : 0.75)
                    }
                  />
                );
              }),
            ),
          )}

          {/* Neurons */}
          {net.sizes.map((n, l) =>
            Array.from({ length: n }, (_, i) => {
              const a = activationOf(l, i);
              const lit = front >= l;
              const isSel = selected?.layer === l - 1 && selected?.index === i;
              const isSelInput = selected?.layer === -1 && l === 0 && selected?.index === i;
              const norm =
                a !== null && layerScale ? Math.min(1, Math.abs(a) / layerScale[l]) : 0;
              const isOutput = l === cols - 1;
              const fill =
                mode === "activations" && a !== null && lit
                  ? rampAt(SEQUENTIAL, 0.15 + norm * 0.75)
                  : CHROME.surface2;

              const delta =
                grad && l > 0 ? grad.delta[l - 1]?.[i] : undefined;

              return (
                <g
                  key={`n${l}-${i}`}
                  onClick={() =>
                    onSelect?.(
                      isSel || isSelInput ? null : { layer: l - 1, index: i },
                    )
                  }
                  style={{ cursor: onSelect ? "pointer" : undefined }}
                >
                  <circle
                    cx={colX(l)}
                    cy={rowY(l, i)}
                    r={radius}
                    fill={fill}
                    stroke={
                      isSel || isSelInput
                        ? CHROME.accent
                        : isOutput && classNames
                          ? classColor(i)
                          : CHROME.lineStrong
                    }
                    strokeWidth={isSel || isSelInput ? 2.5 : 1.5}
                    opacity={lit ? 1 : 0.35}
                  />
                  {showValues && a !== null && lit && radius >= 11 && (
                    <text
                      x={colX(l)}
                      y={rowY(l, i) + 3}
                      textAnchor="middle"
                      fontSize={8.5}
                      fill={norm > 0.55 ? CHROME.plane : CHROME.ink}
                      className="tnum"
                    >
                      {a.toFixed(1)}
                    </text>
                  )}
                  {mode === "gradients" && delta !== undefined && lit && (
                    <text
                      x={colX(l) + radius + 4}
                      y={rowY(l, i) + 3}
                      fontSize={8.5}
                      fill={CHROME.ink2}
                      className="tnum"
                    >
                      δ {delta.toFixed(3)}
                    </text>
                  )}
                </g>
              );
            }),
          )}

          {/* Layer captions */}
          {net.sizes.map((n, l) => (
            <text
              key={`lab${l}`}
              x={colX(l)}
              y={height - 8}
              textAnchor="middle"
              fontSize={9.5}
              fill={CHROME.inkMuted}
            >
              {l === 0 ? "entrée" : l === cols - 1 ? "sortie" : `cachée ${l}`} ({n})
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/** The signed-weight colour key. Shown wherever connections carry a sign. */
export function WeightLegend({ label = "Poids" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-ink-muted">
      <span>{label} :</span>
      <span>négatif</span>
      <span
        className="h-2 w-16 rounded-full"
        style={{
          // Must match rampAt(DIVERGING, (t+1)/2): t = -1 lands on DIVERGING[0].
          background: `linear-gradient(to right, ${DIVERGING[0]}, ${DIVERGING[3]}, ${DIVERGING[6]})`,
        }}
        aria-hidden
      />
      <span>positif</span>
      <span className="ml-1">· épaisseur = intensité</span>
    </div>
  );
}
