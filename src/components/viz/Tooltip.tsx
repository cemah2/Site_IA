"use client";

import * as React from "react";

/**
 * A plot tooltip, positioned in pixel space and flipped near the right/bottom
 * edges so it never leaves the frame.
 *
 * `pointer-events: none` matters: a tooltip that intercepts the pointer makes
 * the mark underneath it un-hoverable and produces a flicker loop.
 */
export function PlotTooltip({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const flipX = x > width - 150;
  const flipY = y > height - 80;
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-line-strong bg-surface-2/95 px-2.5 py-1.5 text-[11px] leading-snug text-ink shadow-lg backdrop-blur-sm"
      style={{
        left: flipX ? undefined : x + 12,
        right: flipX ? width - x + 12 : undefined,
        top: flipY ? undefined : y + 12,
        bottom: flipY ? height - y + 12 : undefined,
      }}
    >
      {children}
    </div>
  );
}
