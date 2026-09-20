"use client";

import * as React from "react";
/**
 * Holds the space a 3-D view will occupy while its code is fetched.
 *
 * Sized rather than empty: the 3-D canvases are large, and a collapsed box that
 * expands a moment later pushes the rest of the page down under the reader's
 * cursor — which is worse than a brief placeholder.
 */
export function Viz3DPlaceholder({ height = 400 }: { height?: number }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-lg border border-line bg-surface-2/40"
      style={{ height }}
      role="status"
    >
      <span className="text-[12px] text-ink-muted">Chargement de la vue 3D…</span>
    </div>
  );
}
