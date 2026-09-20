"use client";

import * as React from "react";
import type { Field } from "@/lib/ml/types";
import { boundaryCells } from "@/lib/ml/field";
import { classColor, CHROME } from "@/lib/viz/palette";
import { usePlot } from "./Plot";

/**
 * The decision surface, rendered to an offscreen canvas and blitted into the
 * SVG as an image.
 *
 * Canvas rather than 96×96 = 9216 SVG rects: the field is recomputed on every
 * slider tick, and the DOM cost of ten thousand nodes would make the very
 * interactivity the page is about feel sluggish.
 *
 * Two encodings are layered, and the split is deliberate:
 *   - hue says *which* class wins (categorical),
 *   - alpha says *how confidently* (magnitude), scaled to a narrow band so the
 *     data points always stay readable on top.
 * The boundary itself is then stroked explicitly, because a colour change
 * between two 10 %-opacity fills is not a line anyone can actually see.
 */
export function DecisionField({
  field,
  opacity = 1,
  showConfidence = true,
  showBoundary = true,
}: {
  field: Field | null;
  opacity?: number;
  showConfidence?: boolean;
  showBoundary?: boolean;
}) {
  const frame = usePlot();
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!field) {
      setUrl(null);
      return;
    }
    const { res, label, confidence } = field;
    const canvas = document.createElement("canvas");
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = ctx.createImageData(res, res);
    const edge = showBoundary ? boundaryCells(field) : null;
    const edgeRgb = hexToRgb(CHROME.ink);

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const src = j * res + i;
        // Canvas row 0 is the top; field row 0 is yMin (the bottom).
        const dst = ((res - 1 - j) * res + i) * 4;

        if (edge && edge[src]) {
          img.data[dst] = edgeRgb[0];
          img.data[dst + 1] = edgeRgb[1];
          img.data[dst + 2] = edgeRgb[2];
          img.data[dst + 3] = 165;
          continue;
        }

        const [r, g, b] = hexToRgb(classColor(label[src]));
        // 0.5 (a coin toss between two classes) maps to the floor, 1.0 to the
        // ceiling: uncertain regions visibly fade toward the plot surface.
        const conf = showConfidence ? confidence[src] : 1;
        const t = Math.min(1, Math.max(0, (conf - 0.5) * 2));
        img.data[dst] = r;
        img.data[dst + 1] = g;
        img.data[dst + 2] = b;
        img.data[dst + 3] = Math.round((0.1 + 0.28 * t) * 255);
      }
    }

    ctx.putImageData(img, 0, 0);
    setUrl(canvas.toDataURL());
  }, [field, showConfidence, showBoundary]);

  if (!url) return null;

  return (
    <image
      href={url}
      x={frame.inner.x}
      y={frame.inner.y}
      width={frame.inner.w}
      height={frame.inner.h}
      opacity={opacity}
      preserveAspectRatio="none"
      style={{ imageRendering: "auto" }}
      clipPath="url(#plot-clip)"
      aria-hidden
    />
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
