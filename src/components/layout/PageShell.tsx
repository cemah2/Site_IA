import * as React from "react";
import { cx } from "@/components/ui";

/**
 * Standard page header + body.
 *
 * Every algorithm page follows the same rhythm — visualisation, then
 * manipulation, then explanation, then the maths, then a worked example — so
 * the learner never has to re-learn where things are when they switch
 * algorithms.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cx("mx-auto px-5 py-8 lg:px-10 lg:py-12", wide ? "max-w-[1600px]" : "max-w-[1400px]")}>
      <header className="mb-7 max-w-3xl">
        {eyebrow && (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[27px] font-semibold leading-tight tracking-tight text-ink lg:text-[32px]">
          {title}
        </h1>
        {lede && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </header>
      {children}
    </div>
  );
}

/** The two-column workspace: visualisation left, controls right. */
export function Workbench({
  plot,
  controls,
  controlsTitle = "Contrôles",
  below,
}: {
  plot: React.ReactNode;
  controls: React.ReactNode;
  controlsTitle?: string;
  below?: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{plot}</div>
      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface-1/80">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{controlsTitle}</h2>
          </header>
          <div className="space-y-4 p-4">{controls}</div>
        </div>
        {below}
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4 mt-10 border-b border-line pb-2.5">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{children}</h2>
      {hint && <p className="mt-1 text-[13px] text-ink-2">{hint}</p>}
    </div>
  );
}
