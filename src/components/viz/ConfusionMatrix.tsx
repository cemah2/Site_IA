"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { ClassMark } from "./Legend";
import { rampAt, SEQUENTIAL, CHROME } from "@/lib/viz/palette";

/**
 * A confusion matrix, cell-selectable.
 *
 * Accuracy is one number; a confusion matrix is the answer to "which
 * confusions, exactly?" — and on an imbalanced problem those are entirely
 * different questions. Cells are clickable so the selection can highlight the
 * corresponding points in the plot: *which* samples are in that cell is the
 * next question a learner always has.
 *
 * Counts use a sequential ramp (magnitude), with the diagonal — the correct
 * predictions — outlined rather than given its own hue, so the shape of the
 * errors stays the thing you read first.
 */
export function ConfusionMatrix({
  matrix,
  classNames,
  selected,
  onSelect,
  compact = false,
}: {
  matrix: number[][];
  classNames: string[];
  selected?: { trueClass: number; predicted: number } | null;
  onSelect?: (cell: { trueClass: number; predicted: number } | null) => void;
  compact?: boolean;
}) {
  const max = Math.max(1, ...matrix.flat());
  const cell = compact ? 26 : 38;

  return (
    <div className="inline-block">
      <div className="mb-1 pl-[3.2rem] text-[10px] text-ink-muted">prédit →</div>
      <div className="flex">
        <div
          className="mr-1 flex items-center text-[10px] text-ink-muted"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          réel →
        </div>
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {classNames.map((name, c) => (
                <th key={name} className="pb-0.5">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-ink-muted">
                    <ClassMark index={c} size={8} />
                    {name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, t) => (
              <tr key={t}>
                <th className="pr-1">
                  <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                    <ClassMark index={t} size={8} />
                    {classNames[t]}
                  </span>
                </th>
                {row.map((count, p) => {
                  const isDiag = t === p;
                  const isSelected = selected?.trueClass === t && selected?.predicted === p;
                  return (
                    <td key={p}>
                      <button
                        onClick={() =>
                          onSelect?.(isSelected ? null : { trueClass: t, predicted: p })
                        }
                        disabled={!onSelect || count === 0}
                        title={
                          isDiag
                            ? `${count} ${classNames[t]} correctement classés`
                            : `${count} ${classNames[t]} pris pour des ${classNames[p]}`
                        }
                        className={cx(
                          "tnum flex items-center justify-center rounded text-[11px] font-semibold transition-all",
                          onSelect && count > 0 && "hover:ring-2 hover:ring-accent/60",
                          isSelected && "ring-2 ring-accent",
                        )}
                        style={{
                          width: cell,
                          height: cell,
                          background: count
                            ? rampAt(SEQUENTIAL, 0.12 + (count / max) * 0.8)
                            : CHROME.surface2,
                          color: count / max > 0.45 ? CHROME.plane : CHROME.ink2,
                          outline: isDiag ? `1px dashed ${CHROME.lineStrong}` : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        {count || ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 max-w-[16rem] text-[10px] leading-snug text-ink-muted">
        Diagonale en pointillés = bonnes réponses. Tout ce qui est hors diagonale est une
        confusion{onSelect ? " — cliquez une case pour voir les points concernés" : ""}.
      </p>
    </div>
  );
}
