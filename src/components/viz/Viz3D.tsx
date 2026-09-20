"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import * as React from "react";
import { plotInteraction } from "@/lib/viz/interaction";

/**
 * A 3-D canvas that only draws when it is actually on screen.
 *
 * Every 3-D panel on this site sits under a 2-D plot the learner is busy
 * dragging, usually below the fold. A WebGL canvas that keeps rendering there
 * spends CPU, GPU and battery on pixels nobody is looking at — and on a laptop
 * without a discrete GPU that competes directly with the interaction above it.
 *
 * Three conditions, and none is R3F's default of rendering forever:
 *   off screen          — no frames at all.
 *   a drag in progress  — no frames at all: a WebGL frame costs far more than
 *                         the SVG update the learner is actually watching, and
 *                         the 3-D panel is the least important thing on screen
 *                         while they are moving a point.
 *   visible and idle    — a frame only when the scene actually changes.
 *
 * `prefers-reduced-motion` is deliberately not consulted: these scenes are
 * rotated by the viewer rather than animated at them, so freezing them would
 * remove the content rather than calm it.
 */
export function Viz3DCanvas({
  children,
  ...canvasProps
}: Omit<CanvasProps, "frameloop">) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    // No observer available (very old browser): render on demand rather than
    // never, so the scene is not silently blank.
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setVisible(true));
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      // A margin so the scene is already live by the time it scrolls in.
      { rootMargin: "150px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dragging = React.useSyncExternalStore(
    plotInteraction.subscribe,
    plotInteraction.getSnapshot,
    plotInteraction.getServerSnapshot,
  );

  return (
    <div ref={hostRef} style={{ width: "100%", height: "100%" }}>
      <Canvas frameloop={visible && !dragging ? "demand" : "never"} {...canvasProps}>
        {children}
      </Canvas>
    </div>
  );
}
