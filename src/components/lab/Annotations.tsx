"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { useSeenFlag } from "@/lib/hooks/useLocalState";
import { CHROME } from "@/lib/viz/palette";

export interface Annotation {
  /** Position within the plot box, as percentages. */
  x: number;
  y: number;
  text: string;
  /** Which side the label sits on, so it never covers what it points at. */
  side?: "left" | "right";
}

/**
 * Labels that name the parts of a visualisation the first time it is seen.
 *
 * A beginner looking at a scatter plot with a shaded background does not
 * automatically know which mark is the data and which is the model's opinion.
 * These say so — once. They disappear on the first interaction and stay gone,
 * because a label you have already read is clutter.
 *
 * They are `aria-hidden`: the same information is in the panel's subtitle and
 * legend, which a screen reader already gets in a better order.
 */
export function Annotations({
  items,
  storageKey,
  className,
}: {
  items: Annotation[];
  /** Remembers dismissal per visualisation, across visits. */
  storageKey: string;
  className?: string;
}) {
  const [dismissed, dismiss] = useSeenFlag(`annot.${storageKey}`);

  if (dismissed) return null;

  return (
    <div
      className={cx("pointer-events-none absolute inset-0 z-20", className)}
      aria-hidden
      onPointerDownCapture={dismiss}
    >
      {items.map((a) => (
        <div
          key={a.text}
          className="absolute"
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            transform: `translate(${a.side === "left" ? "-100%" : "0"}, -50%)`,
          }}
        >
          <div className="flex items-center gap-1.5">
            {a.side === "left" && (
              <>
                <span className="whitespace-nowrap rounded-md border border-accent/40 bg-surface-2/95 px-2 py-1 text-[11px] text-ink shadow-lg backdrop-blur-sm">
                  {a.text}
                </span>
                <span
                  className="h-px w-5"
                  style={{ background: CHROME.accent }}
                />
              </>
            )}
            {a.side !== "left" && (
              <>
                <span className="h-px w-5" style={{ background: CHROME.accent }} />
                <span className="whitespace-nowrap rounded-md border border-accent/40 bg-surface-2/95 px-2 py-1 text-[11px] text-ink shadow-lg backdrop-blur-sm">
                  {a.text}
                </span>
              </>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={dismiss}
        className="pointer-events-auto absolute bottom-2 right-2 rounded-md border border-line-strong bg-surface-2/95 px-2 py-1 text-[10px] text-ink-2 backdrop-blur-sm hover:text-ink"
      >
        Compris, masquer
      </button>
    </div>
  );
}
