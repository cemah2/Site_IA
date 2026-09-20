"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { shapePath } from "@/lib/viz/geometry";
import { classColor, classShape } from "@/lib/viz/palette";

/**
 * Class legend. Present whenever two or more classes are on screen — identity
 * is never left to colour alone, and the legend repeats the marker shape so it
 * matches exactly what is drawn in the plot.
 */
export function ClassLegend({
  classNames,
  counts,
  active,
  onSelect,
  className,
  title,
}: {
  classNames: string[];
  counts?: number[];
  active?: number | null;
  onSelect?: (i: number) => void;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {title && <span className="text-[11px] text-ink-muted">{title}</span>}
      {classNames.map((name, i) => {
        const selectable = Boolean(onSelect);
        const isActive = active === i;
        const Tag = selectable ? "button" : "div";
        return (
          <Tag
            key={name}
            onClick={selectable ? () => onSelect?.(i) : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors",
              selectable && "hover:bg-surface-2",
              isActive && "bg-surface-3 ring-1 ring-line-strong",
            )}
          >
            <ClassMark index={i} />
            <span className={cx(isActive ? "text-ink" : "text-ink-2")}>
              Classe {name}
              {counts && <span className="tnum ml-1 text-ink-muted">({counts[i] ?? 0})</span>}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

/** The marker for one class, at legend size. */
export function ClassMark({ index, size = 11 }: { index: number; size?: number }) {
  const r = size / 2.6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <path d={shapePath(classShape(index), size / 2, size / 2, r)} fill={classColor(index)} />
    </svg>
  );
}
