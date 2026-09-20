"use client";

import Link from "next/link";
import * as React from "react";
import { Button, cx } from "@/components/ui";
import { COURSE, COURSE_MINUTES, COURSE_STEPS } from "@/lib/course";
import { useCourseProgress } from "./CourseProgress";
import { STATUS } from "@/lib/viz/palette";

/**
 * The course, as a checklist.
 *
 * Progress is the point: a beginner's main question is not "what is here" but
 * "where am I and what is next", and a table of contents answers neither.
 */
export function CoursePathway({ compact = false }: { compact?: boolean }) {
  const { done, reset } = useCourseProgress();
  const count = COURSE_STEPS.filter((s) => done.includes(s.href)).length;
  const next = COURSE_STEPS.find((s) => !done.includes(s.href)) ?? COURSE_STEPS[0];
  const remaining = COURSE_STEPS.filter((s) => !done.includes(s.href)).reduce(
    (a, s) => a + s.minutes,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-1/70 px-4 py-3.5">
        <div className="min-w-[10rem] flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-ink-2">
              {count === 0
                ? `${COURSE_STEPS.length} étapes · environ ${Math.round(COURSE_MINUTES / 60)} h au total`
                : `${count} étape${count > 1 ? "s" : ""} sur ${COURSE_STEPS.length}`}
            </span>
            {count > 0 && (
              <span className="tnum text-[11px] text-ink-muted">
                il reste ~{remaining} min
              </span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(count / COURSE_STEPS.length) * 100}%`,
                background: STATUS.good,
              }}
            />
          </div>
        </div>
        <Link href={next.href}>
          <Button variant="primary">
            {count === 0 ? "Commencer" : "Reprendre"} : {next.title} →
          </Button>
        </Link>
        {count > 0 && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Remettre à zéro
          </Button>
        )}
      </div>

      <ol className="space-y-6">
        {COURSE.map((chapter) => {
          const chapterDone = chapter.steps.filter((s) => done.includes(s.href)).length;
          return (
            <li key={chapter.id}>
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                  {chapter.title}
                </h2>
                <span className="tnum text-[11px] text-ink-muted">
                  {chapterDone} / {chapter.steps.length}
                </span>
              </div>
              {!compact && (
                <p className="mb-3 max-w-2xl text-[13px] leading-relaxed text-ink-2">
                  {chapter.why}
                </p>
              )}
              <ul className="space-y-1.5">
                {chapter.steps.map((step) => {
                  const isDone = done.includes(step.href);
                  const isNext = step.href === next.href;
                  return (
                    <li key={step.href}>
                      <Link
                        href={step.href}
                        className={cx(
                          "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                          isNext
                            ? "border-accent/45 bg-accent/[0.06]"
                            : "border-line bg-surface-1/50 hover:border-line-strong hover:bg-surface-2/50",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cx(
                            "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                            isDone ? "bg-good/20" : "bg-surface-3 text-ink-muted",
                          )}
                          style={isDone ? { color: STATUS.good } : undefined}
                        >
                          {isDone ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span
                              className={cx(
                                "text-[13.5px] font-medium",
                                isDone ? "text-ink-2" : "text-ink",
                              )}
                            >
                              {step.title}
                            </span>
                            <span className="tnum text-[11px] text-ink-muted">
                              {step.minutes} min
                            </span>
                          </span>
                          {!compact && (
                            <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                              {step.outcome}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Votre progression est enregistrée dans votre navigateur uniquement — aucun compte,
        aucun envoi. Une page est marquée comme lue après une vingtaine de secondes passées
        dessus, pas au chargement : ces pages sont faites pour être manipulées.
      </p>
    </div>
  );
}
