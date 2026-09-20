"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { linearScale, ticks, type Scale } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";

export interface PlotFrame {
  width: number;
  height: number;
  /** Inner drawing area, excluding axis gutters. */
  inner: { x: number; y: number; w: number; h: number };
  sx: Scale;
  sy: Scale;
  /** Data-space -> pixel-space. */
  px: (x: number, y: number) => [number, number];
  /** Pixel-space -> data-space. */
  data: (px: number, py: number) => [number, number];
}

const PlotContext = React.createContext<PlotFrame | null>(null);

export function usePlot(): PlotFrame {
  const ctx = React.useContext(PlotContext);
  if (!ctx) throw new Error("usePlot must be used inside <Plot>");
  return ctx;
}

const PAD = { top: 12, right: 12, bottom: 28, left: 34 };

/**
 * A square-ish plotting frame with linear axes and a data/pixel coordinate
 * context.
 *
 * The frame is measured with a ResizeObserver rather than given a fixed size,
 * because every page puts the plot in a different column width and a
 * visualisation that overflows on a laptop is worse than none.
 *
 * Axes and grid are drawn recessively (hairline grid, muted labels) so that the
 * data marks are the only thing with visual weight.
 */
export function Plot({
  xDomain,
  yDomain,
  children,
  className,
  aspect = 1,
  xLabel,
  yLabel,
  showGrid = true,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
  onKeyDown,
  onFocus,
  onBlur,
  focusable = false,
  cursor,
  ariaLabel,
  ariaDescription,
  maxWidth,
}: {
  xDomain: [number, number];
  yDomain: [number, number];
  children: React.ReactNode | ((frame: PlotFrame) => React.ReactNode);
  className?: string;
  aspect?: number;
  xLabel?: string;
  yLabel?: string;
  showGrid?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => void;
  onPointerLeave?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onContextMenu?: (e: React.MouseEvent<SVGSVGElement>, frame: PlotFrame) => void;
  onKeyDown?: (e: React.KeyboardEvent<SVGSVGElement>, frame: PlotFrame) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Makes the plot a tab stop. Set it wherever the plot can be operated. */
  focusable?: boolean;
  cursor?: string;
  ariaLabel?: string;
  /** Longer instructions, linked with aria-describedby rather than crammed
   *  into the label — a screen reader reads the label on every focus. */
  ariaDescription?: string;
  /** Cap the drawing width. With aspect = 1 this keeps the axes orthonormal on
   *  wide screens instead of producing a plot taller than the viewport. */
  maxWidth?: number;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  // `null` until the element has actually been measured. The frame's geometry
  // depends on the width the browser gives it, which the server cannot know,
  // so the plot is rendered client-side only — otherwise React hydration
  // compares two different sets of coordinates and tears the whole subtree down.
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(220, Math.round(entry.contentRect.width));
      setSize({ w, h: Math.round(w * aspect) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const frame = React.useMemo<PlotFrame>(() => {
    const w = size?.w ?? 480;
    const h = size?.h ?? Math.round(480 * aspect);
    const inner = {
      x: PAD.left,
      y: PAD.top,
      w: Math.max(10, w - PAD.left - PAD.right),
      h: Math.max(10, h - PAD.top - PAD.bottom),
    };
    const sx = linearScale(xDomain, [inner.x, inner.x + inner.w]);
    // y is inverted: data grows upward, pixels grow downward.
    const sy = linearScale(yDomain, [inner.y + inner.h, inner.y]);
    return {
      width: w,
      height: h,
      inner,
      sx,
      sy,
      px: (x, y) => [sx(x), sy(y)],
      data: (px, py) => [sx.invert(px), sy.invert(py)],
    };
  }, [size, aspect, xDomain, yDomain]);

  const descriptionId = React.useId();
  const xTicks = React.useMemo(() => ticks(xDomain, 6), [xDomain]);
  const yTicks = React.useMemo(() => ticks(yDomain, 6), [yDomain]);

  const relay =
    (handler?: (e: React.PointerEvent<SVGSVGElement>, f: PlotFrame) => void) =>
    (e: React.PointerEvent<SVGSVGElement>) =>
      handler?.(e, frame);

  return (
    <div
      ref={hostRef}
      className={cx("relative mx-auto w-full", className)}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {ariaDescription && (
        <p id={descriptionId} className="sr-only">
          {ariaDescription}
        </p>
      )}
      {size === null ? (
        <div
          aria-hidden
          className="w-full animate-pulse rounded-lg bg-surface-2/40"
          style={{ aspectRatio: `1 / ${aspect}` }}
        />
      ) : (
      <svg
        width={frame.width}
        height={frame.height}
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        role={focusable ? "application" : "img"}
        aria-label={ariaLabel}
        aria-describedby={ariaDescription ? descriptionId : undefined}
        tabIndex={focusable ? 0 : undefined}
        style={{ cursor, touchAction: "none" }}
        className="block select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        onKeyDown={onKeyDown ? (e) => onKeyDown(e, frame) : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerDown={relay(onPointerDown)}
        onPointerMove={relay(onPointerMove)}
        onPointerUp={relay(onPointerUp)}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, frame) : undefined}
      >
        <defs>
          <clipPath id="plot-clip">
            <rect x={frame.inner.x} y={frame.inner.y} width={frame.inner.w} height={frame.inner.h} />
          </clipPath>
        </defs>

        {showGrid && (
          <g aria-hidden>
            {xTicks.map((t) => (
              <line
                key={`gx${t}`}
                x1={frame.sx(t)}
                x2={frame.sx(t)}
                y1={frame.inner.y}
                y2={frame.inner.y + frame.inner.h}
                stroke={CHROME.grid}
                strokeWidth={1}
              />
            ))}
            {yTicks.map((t) => (
              <line
                key={`gy${t}`}
                x1={frame.inner.x}
                x2={frame.inner.x + frame.inner.w}
                y1={frame.sy(t)}
                y2={frame.sy(t)}
                stroke={CHROME.grid}
                strokeWidth={1}
              />
            ))}
          </g>
        )}

        <PlotContext.Provider value={frame}>
          {typeof children === "function" ? children(frame) : children}
        </PlotContext.Provider>

        {/* Axes last, so they sit above translucent decision fills. */}
        <g aria-hidden>
          <rect
            x={frame.inner.x}
            y={frame.inner.y}
            width={frame.inner.w}
            height={frame.inner.h}
            fill="none"
            stroke={CHROME.axis}
            strokeWidth={1}
          />
          {xTicks.map((t) => (
            <text
              key={`tx${t}`}
              x={frame.sx(t)}
              y={frame.inner.y + frame.inner.h + 14}
              textAnchor="middle"
              fontSize={10}
              fill={CHROME.inkMuted}
              className="tnum"
            >
              {t}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={`ty${t}`}
              x={frame.inner.x - 6}
              y={frame.sy(t) + 3}
              textAnchor="end"
              fontSize={10}
              fill={CHROME.inkMuted}
              className="tnum"
            >
              {t}
            </text>
          ))}
          {xLabel && (
            <text
              x={frame.inner.x + frame.inner.w}
              y={frame.inner.y + frame.inner.h + 25}
              textAnchor="end"
              fontSize={10}
              fill={CHROME.inkMuted}
            >
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              x={frame.inner.x - 6}
              y={frame.inner.y - 3}
              textAnchor="end"
              fontSize={10}
              fill={CHROME.inkMuted}
            >
              {yLabel}
            </text>
          )}
        </g>
      </svg>
      )}
    </div>
  );
}

/** Convert a pointer event to plot-local pixel coordinates. */
export function localPoint(e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>): [number, number] {
  const svg = e.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}
