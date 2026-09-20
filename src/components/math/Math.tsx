"use client";

import katex from "katex";
import * as React from "react";
import { cx } from "@/components/ui";

/**
 * KaTeX rendering.
 *
 * `throwOnError: false` is deliberate: a malformed formula should degrade to
 * visible red source text on the page rather than crash the surrounding
 * interactive visualisation, which is usually the part the learner came for.
 */
function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: false,
    output: "html",
  });
}

export function Tex({ children, className }: { children: string; className?: string }) {
  const html = React.useMemo(() => render(children, false), [children]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TexBlock({ children, className }: { children: string; className?: string }) {
  const html = React.useMemo(() => render(children, true), [children]);
  return (
    <div
      // `min-w-0` makes `overflow-x-auto` actually do something here: without
      // it the block still claims its full intrinsic width from the layout.
      className={cx("min-w-0 overflow-x-auto py-1 text-ink", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * A formula with live numbers underneath it.
 *
 * The brief's rule — "a formula must be accompanied by a visualisation of what
 * it actually represents" — is implemented here as a contract: every symbol in
 * `terms` gets its current numeric value printed under the maths, so the
 * equation and the running computation are never two separate things.
 */
export function LiveFormula({
  tex,
  terms,
  result,
  className,
}: {
  tex: string;
  terms?: { symbol: string; value: React.ReactNode; color?: string; label?: string }[];
  result?: { label: React.ReactNode; value: React.ReactNode };
  className?: string;
}) {
  return (
    <div className={cx("rounded-lg border border-line bg-surface-2/40 px-3.5 py-3", className)}>
      <TexBlock className="!py-0">{tex}</TexBlock>
      {terms && terms.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-2.5">
          {terms.map((t) => (
            <div key={t.symbol} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                {t.color && (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: t.color }}
                  />
                )}
                <Tex>{t.symbol}</Tex>
                {t.label && <span className="text-ink-muted">· {t.label}</span>}
              </dt>
              <dd className="tnum mt-0.5 text-sm font-semibold text-ink">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {result && (
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
          <span className="text-xs text-ink-2">{result.label}</span>
          <span className="tnum text-base font-semibold text-ink">{result.value}</span>
        </div>
      )}
    </div>
  );
}
