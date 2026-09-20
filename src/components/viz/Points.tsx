"use client";

import * as React from "react";
import type { Sample } from "@/lib/ml/types";
import { shapePath } from "@/lib/viz/geometry";
import { classColor, classShape, CHROME, STATUS, withAlpha } from "@/lib/viz/palette";
import { usePlot } from "./Plot";

export interface PointStyle {
  /** Dimmed points recede without disappearing — used for "not a neighbour". */
  dim?: boolean;
  /** A visible ring: the current query point, a support vector, a selection. */
  ring?: string;
  /** Marks a misclassified sample. */
  wrong?: boolean;
  scale?: number;
}

/**
 * Sample markers.
 *
 * Every point carries BOTH a colour and a shape for its class. That is not
 * decoration: on the tighter colour pairs the five-class palette relies on
 * shape to stay separable for colour-blind readers, and shape is also what
 * survives a screenshot pasted into a monochrome document.
 *
 * Each mark gets a 2 px ring in the plot surface colour so that overlapping
 * points stay countable instead of merging into a blob.
 */
export function Points({
  samples,
  radius = 4.5,
  styleFor,
  onHover,
  onPointerDownPoint,
  interactive = false,
}: {
  samples: Sample[];
  radius?: number;
  styleFor?: (s: Sample) => PointStyle | undefined;
  onHover?: (s: Sample | null) => void;
  onPointerDownPoint?: (s: Sample, e: React.PointerEvent) => void;
  interactive?: boolean;
}) {
  const frame = usePlot();

  return (
    <g clipPath="url(#plot-clip)">
      {samples.map((s) => {
        const st = styleFor?.(s) ?? {};
        const [cx, cy] = frame.px(s.x[0], s.x[1]);
        const r = radius * (st.scale ?? 1);
        const color = classColor(s.y);
        return (
          <g
            key={s.id}
            onPointerEnter={onHover ? () => onHover(s) : undefined}
            onPointerLeave={onHover ? () => onHover(null) : undefined}
            onPointerDown={onPointerDownPoint ? (e) => onPointerDownPoint(s, e) : undefined}
            style={{ cursor: interactive ? "grab" : undefined }}
          >
            {/* Hit target, larger than the mark — 4 px marks are hard to grab. */}
            {(onHover || onPointerDownPoint) && (
              <circle cx={cx} cy={cy} r={Math.max(9, r + 5)} fill="transparent" />
            )}
            {st.ring && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 4.5}
                fill="none"
                stroke={st.ring}
                strokeWidth={1.5}
                opacity={0.9}
              />
            )}
            <path
              d={shapePath(classShape(s.y), cx, cy, r)}
              fill={st.dim ? withAlpha(color, 0.55) : color}
              stroke={CHROME.surface1}
              strokeWidth={1.75}
              opacity={st.dim ? 0.85 : 1}
            />
            {/* Misclassified: a small badge set beside the mark rather than a
                cross drawn through it. Over the mark it hides the very point it
                is annotating, and a field of large crosses reads as noise. */}
            {st.wrong && (
              <path
                d={`M${cx + r * 1.1},${cy - r * 2.3}l${r * 1.5},${r * 1.5}M${cx + r * 2.6},${cy - r * 2.3}l${-r * 1.5},${r * 1.5}`}
                stroke={STATUS.critical}
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
                style={{ paintOrder: "stroke" }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
