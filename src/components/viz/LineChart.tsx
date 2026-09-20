"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { linearScale, ticks } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
}

/**
 * A line chart with a crosshair and a shared tooltip.
 *
 * One y-axis, always. Curves of different scales (a loss in nats and an
 * accuracy in percent) go in two stacked charts rather than one chart with two
 * axes: a dual-axis plot lets the author put any two curves in any relative
 * position by choosing the scales, so the crossings it shows are decoration,
 * not information.
 */
export function LineChart({
  series,
  height = 170,
  yDomain,
  xLabel,
  yLabel,
  yFormat = (v) => v.toFixed(2),
  xFormat = (v) => String(Math.round(v)),
  marker,
  onHoverIndex,
  className,
  zeroFloor = true,
}: {
  series: Series[];
  height?: number;
  yDomain?: [number, number];
  xLabel?: string;
  yLabel?: string;
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  /** Vertical rule at a given x — the currently selected epoch/step. */
  marker?: number | null;
  onHoverIndex?: (i: number | null) => void;
  className?: string;
  zeroFloor?: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = width ?? 420;
  const pad = { l: 42, r: 10, t: 10, b: 24 };

  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y).filter(Number.isFinite);
  const xDom: [number, number] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  if (xDom[0] === xDom[1]) xDom[1] = xDom[0] + 1;

  const yMax = ys.length ? Math.max(...ys) : 1;
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yDom: [number, number] =
    yDomain ?? [zeroFloor ? Math.min(0, yMin) : yMin - (yMax - yMin) * 0.08, yMax * 1.08 || 1];

  const sx = linearScale(xDom, [pad.l, w - pad.r]);
  const sy = linearScale(yDom, [height - pad.b, pad.t]);
  const yT = ticks(yDom, 4);
  const xT = ticks(xDom, 5);

  const longest = series.reduce((a, s) => Math.max(a, s.points.length), 0);
  const hoverX = hover !== null ? series[0]?.points[hover]?.x : undefined;

  const pickIndex = (clientX: number) => {
    const el = hostRef.current;
    if (!el || !longest) return null;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    const dataX = sx.invert(px);
    let best = 0;
    let bestD = Infinity;
    series[0]?.points.forEach((p, i) => {
      const d = Math.abs(p.x - dataX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <div ref={hostRef} className={cx("relative w-full", className)}>
      {width !== null && (
        <svg
          width={w}
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          className="block"
          role="img"
          aria-label={`${yLabel ?? "valeur"} en fonction de ${xLabel ?? "x"}`}
          onPointerMove={(e) => {
            const i = pickIndex(e.clientX);
            setHover(i);
            onHoverIndex?.(i);
          }}
          onPointerLeave={() => {
            setHover(null);
            onHoverIndex?.(null);
          }}
        >
          <g aria-hidden>
            {yT.map((t) => (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={sy(t)}
                  y2={sy(t)}
                  stroke={CHROME.grid}
                  strokeWidth={1}
                />
                <text
                  x={pad.l - 6}
                  y={sy(t) + 3}
                  textAnchor="end"
                  fontSize={9.5}
                  fill={CHROME.inkMuted}
                  className="tnum"
                >
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {xT.map((t) => (
              <text
                key={t}
                x={sx(t)}
                y={height - 8}
                textAnchor="middle"
                fontSize={9.5}
                fill={CHROME.inkMuted}
                className="tnum"
              >
                {xFormat(t)}
              </text>
            ))}
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={height - pad.b}
              y2={height - pad.b}
              stroke={CHROME.axis}
              strokeWidth={1}
            />
          </g>

          {/* Recessive on purpose: in the accent colour this rule reads as a
              data spike, because the accent sits next to the first series hue.
              Chrome must never be mistakeable for data. */}
          {marker != null && (
            <line
              x1={sx(marker)}
              x2={sx(marker)}
              y1={pad.t}
              y2={height - pad.b}
              stroke={CHROME.lineStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {series.map((s) => (
            <path
              key={s.key}
              d={pathOf(s.points, sx, sy)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {hover !== null && hoverX !== undefined && (
            <>
              <line
                x1={sx(hoverX)}
                x2={sx(hoverX)}
                y1={pad.t}
                y2={height - pad.b}
                stroke={CHROME.lineStrong}
                strokeWidth={1}
              />
              {series.map((s) => {
                const p = s.points[hover];
                if (!p || !Number.isFinite(p.y)) return null;
                return (
                  <circle
                    key={s.key}
                    cx={sx(p.x)}
                    cy={sy(p.y)}
                    r={4}
                    fill={s.color}
                    stroke={CHROME.surface1}
                    strokeWidth={2}
                  />
                );
              })}
            </>
          )}
        </svg>
      )}

      {hover !== null && hoverX !== undefined && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line-strong bg-surface-2/95 px-2 py-1.5 text-[10px] leading-snug shadow-lg"
          style={{
            left: sx(hoverX) > w / 2 ? undefined : sx(hoverX) + 10,
            right: sx(hoverX) > w / 2 ? w - sx(hoverX) + 10 : undefined,
            top: 6,
          }}
        >
          <div className="tnum mb-0.5 font-semibold text-ink">
            {xLabel ? `${xLabel} ` : ""}
            {xFormat(hoverX)}
          </div>
          {series.map((s) => (
            <div key={s.key} className="tnum flex items-center gap-1.5 text-ink-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: s.color }}
              />
              {s.label} : {Number.isFinite(s.points[hover]?.y) ? yFormat(s.points[hover].y) : "—"}
            </div>
          ))}
        </div>
      )}

      {series.length >= 2 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-ink-2">
              <svg width="14" height="6" aria-hidden>
                <line
                  x1="0"
                  y1="3"
                  x2="14"
                  y2="3"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function pathOf(
  points: { x: number; y: number }[],
  sx: (v: number) => number,
  sy: (v: number) => number,
): string {
  let d = "";
  let open = false;
  for (const p of points) {
    // A diverging run produces Infinity/NaN; break the line instead of drawing
    // a stroke to nowhere.
    if (!Number.isFinite(p.y)) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    open = true;
  }
  return d;
}
