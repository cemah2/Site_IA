"use client";

import * as React from "react";
import { computeField } from "@/lib/ml/field";
import type { Classifier, Dataset } from "@/lib/ml/types";
import { classColor, CHROME } from "@/lib/viz/palette";

/**
 * A thumbnail of one model's decision surface, drawn entirely on canvas.
 *
 * Used for small multiples — a forest's individual trees, the algorithm
 * comparison grid. At this size nothing but the shape of the regions is
 * readable, which is exactly the comparison being made: *how differently do
 * these models carve up the same plane?*
 *
 * Fully opaque fills here, unlike the main plot: there is no room for a legend
 * or a boundary stroke at 120 px, so the region colour has to carry the whole
 * message on its own.
 */
export function MiniField({
  model,
  dataset,
  size = 110,
  res = 44,
  showPoints = true,
  highlight,
  label,
  onClick,
}: {
  model: Classifier | null;
  dataset: Dataset;
  size?: number;
  res?: number;
  showPoints?: boolean;
  /** A query point to mark, in data coordinates. */
  highlight?: [number, number] | null;
  label?: React.ReactNode;
  onClick?: () => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !model) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Paint the field at its own resolution first, then scale the whole thing
    // up in one drawImage. Filling `res²` slightly-overlapping rects directly
    // onto the display canvas lands cell edges on fractional pixels and
    // produces a moiré grid that reads as structure in the data.
    const field = computeField(model, dataset.domain, res);
    const src = document.createElement("canvas");
    src.width = res;
    src.height = res;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    const img = sctx.createImageData(res, res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const k = j * res + i;
        // Canvas row 0 is the top; field row 0 is yMin.
        const dst = ((res - 1 - j) * res + i) * 4;
        const [r, g, b] = hexToRgb(classColor(field.label[k]));
        img.data[dst] = r;
        img.data[dst + 1] = g;
        img.data[dst + 2] = b;
        img.data[dst + 3] = Math.round((0.34 + 0.3 * Math.min(1, field.confidence[k])) * 255);
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.drawImage(src, 0, 0, size, size);

    const [[xMin, xMax], [yMin, yMax]] = dataset.domain;
    const toPx = (x: number, y: number): [number, number] => [
      ((x - xMin) / (xMax - xMin)) * size,
      size - ((y - yMin) / (yMax - yMin)) * size,
    ];

    if (showPoints) {
      for (const s of dataset.samples) {
        const [px, py] = toPx(s.x[0], s.x[1]);
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = classColor(s.y);
        ctx.fill();
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = CHROME.surface1;
        ctx.stroke();
      }
    }

    if (highlight) {
      const [px, py] = toPx(highlight[0], highlight[1]);
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = CHROME.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [model, dataset, size, res, showPoints, highlight]);

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="group block shrink-0 text-left"
      style={{ width: size }}
    >
      <canvas
        ref={ref}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="block rounded-md border border-line transition-colors group-hover:border-line-strong"
      />
      {label && <div className="mt-1 text-[10px] leading-tight text-ink-muted">{label}</div>}
    </Tag>
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
