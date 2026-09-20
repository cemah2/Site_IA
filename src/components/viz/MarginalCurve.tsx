"use client";

import * as React from "react";
import { normalPdf } from "@/lib/ml/models/naive-bayes";
import { linearScale } from "@/lib/viz/geometry";
import { classColor, CHROME, withAlpha } from "@/lib/viz/palette";

/**
 * The fitted per-class density along ONE feature, with the query's value marked.
 *
 * This is the picture of the word "likelihood". Naive Bayes fits one Gaussian
 * per (class, feature); `p(xⱼ | c)` is the height of that curve at the query's
 * coordinate, and showing the curves with a vertical rule at the query turns an
 * abstract conditional probability into a length you can compare by eye.
 */
export function MarginalCurve({
  stats,
  classNames,
  domain,
  value,
  height = 96,
  label,
  highlight,
}: {
  stats: { mean: number; std: number }[];
  classNames: string[];
  domain: [number, number];
  value: number;
  height?: number;
  label: string;
  highlight?: number | null;
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

  const w = width ?? 320;
  const pad = { l: 4, r: 4, t: 8, b: 16 };
  const sx = linearScale(domain, [pad.l, w - pad.r]);

  const curves = React.useMemo(() => {
    const N = 120;
    const peak = Math.max(
      ...stats.map((st) => normalPdf(st.mean, st.mean, st.std)),
      1e-6,
    );
    const sy = linearScale([0, peak * 1.08], [height - pad.b, pad.t]);
    return stats.map((st) => {
      const pts: string[] = [];
      for (let i = 0; i <= N; i++) {
        const x = domain[0] + ((domain[1] - domain[0]) * i) / N;
        pts.push(`${sx(x).toFixed(1)},${sy(normalPdf(x, st.mean, st.std)).toFixed(1)}`);
      }
      return {
        line: `M${pts.join("L")}`,
        area: `M${sx(domain[0]).toFixed(1)},${(height - pad.b).toFixed(1)}L${pts.join("L")}L${sx(domain[1]).toFixed(1)},${(height - pad.b).toFixed(1)}Z`,
        atValue: sy(normalPdf(value, st.mean, st.std)),
        density: normalPdf(value, st.mean, st.std),
      };
    });
  }, [stats, domain, value, height, w]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={hostRef} className="w-full">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-ink-2">{label}</span>
        <span className="tnum text-[11px] text-ink-muted">= {value.toFixed(2)}</span>
      </div>
      {width !== null && (
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden className="block">
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={height - pad.b}
            y2={height - pad.b}
            stroke={CHROME.axis}
            strokeWidth={1}
          />
          {curves.map((c, i) => (
            <g key={i} opacity={highlight === null || highlight === undefined || highlight === i ? 1 : 0.28}>
              <path d={c.area} fill={withAlpha(classColor(i), 0.13)} />
              <path d={c.line} fill="none" stroke={classColor(i)} strokeWidth={2} />
            </g>
          ))}
          {/* The query: one vertical rule, and a dot on each curve at its height. */}
          <line
            x1={sx(value)}
            x2={sx(value)}
            y1={pad.t - 4}
            y2={height - pad.b}
            stroke={CHROME.ink}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            opacity={0.8}
          />
          {curves.map((c, i) => (
            <circle
              key={`d${i}`}
              cx={sx(value)}
              cy={c.atValue}
              r={3.5}
              fill={classColor(i)}
              stroke={CHROME.surface1}
              strokeWidth={1.5}
            />
          ))}
          <text
            x={pad.l}
            y={height - 4}
            fontSize={9}
            fill={CHROME.inkMuted}
            className="tnum"
          >
            {domain[0]}
          </text>
          <text
            x={w - pad.r}
            y={height - 4}
            textAnchor="end"
            fontSize={9}
            fill={CHROME.inkMuted}
            className="tnum"
          >
            {domain[1]}
          </text>
        </svg>
      )}
      <ul className="mt-1 space-y-0.5">
        {classNames.map((name, i) => (
          <li key={name} className="tnum flex justify-between text-[10px] text-ink-muted">
            <span>p({label.split(" ")[0]} | {name})</span>
            <span className="font-medium text-ink-2">
              {curves[i]?.density.toFixed(4) ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
