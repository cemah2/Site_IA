"use client";

import * as React from "react";
import type { Dataset, Field, Sample } from "@/lib/ml/types";
import { movePoint, relabelPoint, withoutPoint, withPoint } from "@/lib/ml/datasets";
import { formatNumber } from "@/lib/viz/geometry";
import { CHROME } from "@/lib/viz/palette";
import { DecisionField } from "./DecisionField";
import { Plot, localPoint, type PlotFrame } from "./Plot";
import { Points, type PointStyle } from "./Points";
import { PlotTooltip } from "./Tooltip";
import { ClassMark } from "./Legend";

export type EditMode = "off" | "edit";

/**
 * The dataset plot used across the whole site.
 *
 * Direct manipulation is the point: a learner who *drags a point across the
 * boundary and watches the model respond* understands the model's sensitivity
 * in a way no amount of prose achieves. So the interaction vocabulary is kept
 * small and uniform everywhere:
 *
 *   drag a point            move it
 *   click empty space       add a point of the brush class
 *   shift-click a point     cycle its class
 *   alt-click / right-click delete it
 *
 * Pages that are not about editing (comparison grids, small multiples) pass
 * `mode="off"` and get the same rendering with no interaction at all.
 */
export function DataPlot({
  dataset,
  onChange,
  field,
  mode = "off",
  brushClass = 0,
  styleFor,
  overlay,
  topOverlay,
  onQuery,
  aspect = 1,
  className,
  showConfidence = true,
  showBoundary = true,
  fieldOpacity = 1,
  pointRadius = 4.5,
  ariaLabel,
  extraTooltip,
  maxWidth = 620,
}: {
  dataset: Dataset;
  onChange?: (d: Dataset) => void;
  field?: Field | null;
  mode?: EditMode;
  brushClass?: number;
  styleFor?: (s: Sample) => PointStyle | undefined;
  /** Drawn above the decision field, below the points. */
  overlay?: (frame: PlotFrame) => React.ReactNode;
  /** Drawn above everything — annotations, labels, the query marker. */
  topOverlay?: (frame: PlotFrame) => React.ReactNode;
  /** Click anywhere to place a probe point (KNN, Naive Bayes, tree walkthrough). */
  onQuery?: (x: number, y: number) => void;
  aspect?: number;
  className?: string;
  showConfidence?: boolean;
  showBoundary?: boolean;
  fieldOpacity?: number;
  pointRadius?: number;
  ariaLabel?: string;
  extraTooltip?: (s: Sample) => React.ReactNode;
  /** Passed through to <Plot>. Default keeps square plots a sane size. */
  maxWidth?: number;
}) {
  const [hover, setHover] = React.useState<Sample | null>(null);
  const [cursor, setCursor] = React.useState<[number, number] | null>(null);
  const dragRef = React.useRef<{ id: number; moved: boolean } | null>(null);
  const editable = mode === "edit" && Boolean(onChange);

  const handlePointerDownPoint = (s: Sample, e: React.PointerEvent) => {
    if (!editable || !onChange) return;
    e.stopPropagation();
    if (e.altKey || e.button === 2) {
      onChange(withoutPoint(dataset, s.id));
      return;
    }
    if (e.shiftKey) {
      onChange(relabelPoint(dataset, s.id, (s.y + 1) % dataset.classNames.length));
      return;
    }
    dragRef.current = { id: s.id, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => {
    const [px, py] = localPoint(e);
    setCursor([px, py]);
    const drag = dragRef.current;
    if (!drag || !onChange) return;
    const [dx, dy] = frame.data(px, py);
    dragRef.current = { ...drag, moved: true };
    onChange(movePoint(dataset, drag.id, clamp(dx, frame.sx.domain), clamp(dy, frame.sy.domain)));
  };

  const handleUp = (e: React.PointerEvent<SVGSVGElement>, frame: PlotFrame) => {
    const wasDragging = dragRef.current;
    dragRef.current = null;
    if (wasDragging) return;

    const [px, py] = localPoint(e);
    if (
      px < frame.inner.x ||
      px > frame.inner.x + frame.inner.w ||
      py < frame.inner.y ||
      py > frame.inner.y + frame.inner.h
    ) {
      return;
    }
    const [dx, dy] = frame.data(px, py);

    if (onQuery) {
      onQuery(dx, dy);
      return;
    }
    if (editable && onChange) onChange(withPoint(dataset, dx, dy, brushClass));
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      <Plot
        xDomain={dataset.domain[0]}
        yDomain={dataset.domain[1]}
        aspect={aspect}
        maxWidth={maxWidth}
        xLabel={dataset.featureNames[0]}
        yLabel={dataset.featureNames[1]}
        cursor={onQuery ? "crosshair" : editable ? "crosshair" : "default"}
        ariaLabel={
          ariaLabel ??
          `Nuage de ${dataset.samples.length} points, ${dataset.classNames.length} classes`
        }
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={() => {
          setCursor(null);
          setHover(null);
          dragRef.current = null;
        }}
        onContextMenu={(e) => {
          if (editable) e.preventDefault();
        }}
      >
        {(frame) => (
          <>
            <DecisionField
              field={field ?? null}
              opacity={fieldOpacity}
              showConfidence={showConfidence}
              showBoundary={showBoundary}
            />
            {overlay?.(frame)}
            <Points
              samples={dataset.samples}
              radius={pointRadius}
              styleFor={styleFor}
              onHover={setHover}
              onPointerDownPoint={editable ? handlePointerDownPoint : undefined}
              interactive={editable}
            />
            {topOverlay?.(frame)}
          </>
        )}
      </Plot>

      {hover && cursor && (
        <PlotTooltip x={cursor[0]} y={cursor[1]} width={999} height={999}>
          <div className="flex items-center gap-1.5 font-semibold">
            <ClassMark index={hover.y} />
            Classe {dataset.classNames[hover.y] ?? "?"}
          </div>
          <div className="tnum mt-1 text-ink-2">
            {dataset.featureNames[0]} = {formatNumber(hover.x[0])}
            <br />
            {dataset.featureNames[1]} = {formatNumber(hover.x[1])}
          </div>
          {extraTooltip?.(hover)}
        </PlotTooltip>
      )}
    </div>
  );
}

function clamp(v: number, [lo, hi]: [number, number]): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The interaction cheat-sheet shown under editable plots. */
export function EditHints() {
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
      <Kbd>Glisser</Kbd> déplacer un point · <Kbd>Clic</Kbd> ajouter ·{" "}
      <Kbd>Maj + clic</Kbd> changer de classe · <Kbd>Alt + clic</Kbd> supprimer
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded border border-line bg-surface-2 px-1 py-px font-medium"
      style={{ color: CHROME.ink2 }}
    >
      {children}
    </span>
  );
}
