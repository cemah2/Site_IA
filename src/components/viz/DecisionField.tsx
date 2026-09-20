"use client";

import * as React from "react";
import type { Field } from "@/lib/ml/types";
import { boundarySegments } from "@/lib/ml/field";
import { classColor, CHROME } from "@/lib/viz/palette";
import { usePlot } from "./Plot";

/**
 * The decision surface: a low-resolution colour field plus a full-resolution
 * vector boundary.
 *
 * The field is rendered to an offscreen canvas and blitted in as an image —
 * canvas rather than 10 000 SVG rects, because the field is recomputed on every
 * slider tick and the DOM cost would make the interactivity the page exists for
 * feel sluggish.
 *
 * Two encodings are layered, and the split is deliberate:
 *   - hue says *which* class wins (categorical),
 *   - alpha says *how clearly* it wins (the margin over the runner-up), on a
 *     narrow band so the data points always stay the heaviest thing on screen.
 *
 * The boundary is drawn separately, as SVG. It is the most precise thing on the
 * plot and must look like it: a 1.5 px line at device resolution, not a
 * nine-pixel blur left over from upscaling the field image.
 */
export function DecisionField({
  field,
  opacity = 1,
  showConfidence = true,
  showBoundary = true,
  boundaryColor = CHROME.ink,
}: {
  field: Field | null;
  opacity?: number;
  showConfidence?: boolean;
  showBoundary?: boolean;
  boundaryColor?: string;
}) {
  const frame = usePlot();

  // Derived from `field`, so it is computed during render rather than pushed
  // into state from an effect — an effect here would paint one frame with the
  // previous model's surface before correcting itself.
  // Safe on the server: <Plot> only renders its children once it has measured
  // itself in the browser.
  const url = React.useMemo(() => {
    if (!field || typeof document === "undefined") return null;
    const { res, label, confidence } = field;
    const canvas = document.createElement("canvas");
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = ctx.createImageData(res, res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const src = j * res + i;
        // Canvas row 0 is the top; field row 0 is yMin (the bottom).
        const dst = ((res - 1 - j) * res + i) * 4;
        const [r, g, b] = hexToRgb(classColor(label[src]));
        const t = showConfidence ? Math.min(1, Math.max(0, confidence[src])) : 1;
        img.data[dst] = r;
        img.data[dst + 1] = g;
        img.data[dst + 2] = b;
        img.data[dst + 3] = Math.round((0.05 + 0.14 * t) * 255);
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [field, showConfidence]);

  const path = React.useMemo(() => {
    if (!field || !showBoundary) return "";
    return boundarySegments(field)
      .map((s) => {
        const [x1, y1] = frame.px(s.x1, s.y1);
        const [x2, y2] = frame.px(s.x2, s.y2);
        return `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
      })
      .join("");
  }, [field, showBoundary, frame]);

  if (!url) return null;

  return (
    <g aria-hidden clipPath="url(#plot-clip)">
      <image
        href={url}
        x={frame.inner.x}
        y={frame.inner.y}
        width={frame.inner.w}
        height={frame.inner.h}
        opacity={opacity}
        preserveAspectRatio="none"
      />
      {path && (
        <path
          d={path}
          fill="none"
          stroke={boundaryColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.62 * opacity}
        />
      )}
    </g>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
