"use client";

import * as React from "react";
import { Button, cx } from "@/components/ui";

export interface Stage {
  label: string;
  detail: string;
}

/**
 * Progressive disclosure for an algorithm's steps.
 *
 * The brief's rule — reveal information gradually rather than dumping it — is
 * implemented as an actual gate: the visualisation draws only what the current
 * stage has "reached". A learner at stage 1 cannot see the answer yet, which is
 * what makes the next click worth making.
 */
export function StageStepper({
  stages,
  stage,
  setStage,
  className,
}: {
  stages: Stage[];
  stage: number;
  setStage: (s: number) => void;
  className?: string;
}) {
  const last = stages.length - 1;
  return (
    <div className={cx("space-y-3", className)}>
      <ol className="space-y-1">
        {stages.map((s, i) => {
          const reached = stage >= i;
          return (
            <li key={s.label}>
              <button
                onClick={() => setStage(i)}
                aria-current={stage === i ? "step" : undefined}
                className={cx(
                  "flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  stage === i
                    ? "border-accent/40 bg-accent/[0.07]"
                    : reached
                      ? "border-line bg-surface-2/50 hover:border-line-strong"
                      : "border-transparent hover:bg-surface-2/40",
                )}
              >
                <span
                  className={cx(
                    "tnum mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    reached ? "bg-accent/20 text-accent" : "bg-surface-3 text-ink-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      "block text-[13px] font-medium",
                      reached ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {s.label}
                  </span>
                  {stage === i && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-2">
                      {s.detail}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setStage(Math.max(0, stage - 1))} disabled={stage === 0}>
          ←
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="flex-1"
          onClick={() => setStage(Math.min(last, stage + 1))}
          disabled={stage === last}
        >
          Étape suivante →
        </Button>
      </div>
    </div>
  );
}
