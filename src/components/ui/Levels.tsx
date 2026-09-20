"use client";

import * as React from "react";
import { cx, Segmented } from "@/components/ui";

export type Level = "intuition" | "technique" | "maths";

const LABELS: { value: Level; label: string; title: string }[] = [
  { value: "intuition", label: "Intuition", title: "Sans aucun prérequis" },
  { value: "technique", label: "Technique", title: "Les concepts et le vocabulaire" },
  { value: "maths", label: "Mathématiques", title: "Les formules, en notation standard" },
];

/**
 * Three levels of reading for the same idea.
 *
 * Kept as one component with three bodies rather than three separate sections
 * so that the learner switches *in place* — the visualisation beside it never
 * moves, which is what makes "the same thing, said three ways" land.
 */
export function Levels({
  intuition,
  technique,
  maths,
  className,
  defaultLevel = "intuition",
}: {
  intuition: React.ReactNode;
  technique: React.ReactNode;
  maths: React.ReactNode;
  className?: string;
  defaultLevel?: Level;
}) {
  const [level, setLevel] = React.useState<Level>(defaultLevel);
  const body = { intuition, technique, maths }[level];

  return (
    <div className={cx("rounded-xl border border-line bg-surface-1/80", className)}>
      <div className="border-b border-line p-3">
        <Segmented value={level} options={LABELS} onChange={setLevel} size="sm" />
      </div>
      <div className="prose-lab p-4">{body}</div>
    </div>
  );
}
