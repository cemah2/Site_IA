"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cx } from "@/components/ui";
import { useLocalState } from "@/lib/hooks/useLocalState";
import { COURSE_STEPS, coursePosition } from "@/lib/course";
import { STATUS } from "@/lib/viz/palette";

const VISIT_MS = 25_000;

export function useCourseProgress() {
  const [done, setDone] = useLocalState<string[]>("course.done", []);
  const mark = React.useCallback(
    (href: string) => setDone((d) => (d.includes(href) ? d : [...d, href])),
    [setDone],
  );
  const reset = React.useCallback(() => setDone([]), [setDone]);
  return { done, mark, reset };
}

/**
 * Marks the current page as read once the learner has actually spent time on it.
 *
 * Twenty-five seconds, not `onMount`: these pages are meant to be played with,
 * and a checkmark earned by loading a URL would make the progress bar a lie —
 * and a lie the learner would notice, which costs the whole feature its
 * credibility.
 */
export function CourseVisitTracker() {
  const pathname = usePathname();
  const href = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const { mark } = useCourseProgress();

  React.useEffect(() => {
    if (!coursePosition(href)) return;
    const id = window.setTimeout(() => mark(href), VISIT_MS);
    return () => window.clearTimeout(id);
  }, [href, mark]);

  return null;
}

/** A compact progress bar with the next step, for the sidebar or a page footer. */
export function CourseProgressBar({ className }: { className?: string }) {
  const { done } = useCourseProgress();
  const total = COURSE_STEPS.length;
  const count = COURSE_STEPS.filter((s) => done.includes(s.href)).length;
  const next = COURSE_STEPS.find((s) => !done.includes(s.href));

  if (count === 0) return null;

  return (
    <div className={cx("rounded-lg border border-line bg-surface-2/40 px-3 py-2.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-2">Votre parcours</span>
        <span className="tnum text-[11px] text-ink-muted">
          {count} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(count / total) * 100}%`, background: STATUS.good }}
        />
      </div>
      {next && (
        <Link
          href={next.href}
          className="mt-2 block truncate text-[11px] text-accent hover:underline"
        >
          Suivant : {next.title} →
        </Link>
      )}
    </div>
  );
}

/** The badge shown on a course page: where you are, and what comes next. */
export function CoursePosition({ href }: { href: string }) {
  const pos = coursePosition(href);
  const { done } = useCourseProgress();
  if (!pos) return null;
  const step = COURSE_STEPS[pos.index];
  const next = COURSE_STEPS[pos.index + 1];
  const isDone = done.includes(href);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface-1/60 px-3.5 py-2.5 text-[12px]">
      <span className="tnum text-ink-muted">
        Étape {pos.index + 1} / {pos.total}
      </span>
      <span className="text-ink-muted">·</span>
      <span className="text-ink-2">{step.outcome}</span>
      {isDone && (
        <span className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: STATUS.good }}>
          ✓ lue
        </span>
      )}
      {next && (
        <Link
          href={next.href}
          className={cx("text-[11px] font-medium text-accent hover:underline", !isDone && "ml-auto")}
        >
          Suivant : {next.title} →
        </Link>
      )}
    </div>
  );
}
