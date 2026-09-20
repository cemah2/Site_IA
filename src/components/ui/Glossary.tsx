"use client";

import Link from "next/link";
import * as React from "react";
import { cx } from "@/components/ui";
import { GLOSSARY } from "@/content/glossary";

/**
 * An inline term with its definition one hover (or one tap) away.
 *
 * This is how the site adds explanation without lengthening pages: a reader who
 * already knows the word pays nothing, and a beginner pays one gesture. The
 * alternative — parenthetical definitions in the prose — taxes every reader on
 * every sentence.
 *
 * Deliberately a `<button>` rather than a styled `<span>`: the definition must
 * be reachable by keyboard and by touch, not only by a mouse that can hover.
 * Escape closes it, and the popover is `aria-describedby`-linked so a screen
 * reader announces the definition rather than a bare dotted word.
 */
export function G({
  t,
  children,
  className,
}: {
  t: keyof typeof GLOSSARY;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY[t];
  const [open, setOpen] = React.useState(false);
  const [flip, setFlip] = React.useState(false);
  const hostRef = React.useRef<HTMLSpanElement>(null);
  const id = React.useId();
  const closeTimer = React.useRef<number | null>(null);

  // A missing term is a content bug: noisy in development, but never allowed
  // to take down the page a reader came for.
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`Glossaire : terme inconnu « ${String(t)} »`);
    }
    return <>{children}</>;
  }

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const el = hostRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Flip when there is not enough room to the right for the card.
      setFlip(rect.left + 320 > window.innerWidth);
    }
    setOpen(true);
  };

  // A short grace period so the pointer can travel from the word into the card.
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <span ref={hostRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={cx(
          "cursor-help border-b border-dotted border-accent/60 text-inherit transition-colors hover:border-accent hover:text-ink",
          className,
        )}
      >
        {children ?? entry.term}
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className={cx(
            "absolute z-50 mt-2 block w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface-2 p-3.5 text-left shadow-xl",
            flip ? "right-0" : "left-0",
          )}
          style={{ top: "100%" }}
        >
          <span className="block text-[13px] font-semibold text-ink">{entry.term}</span>
          <span className="mt-1.5 block text-[12px] leading-relaxed text-ink-2">
            {entry.short}
          </span>
          {entry.example && (
            <span className="mt-2 block border-t border-line pt-2 text-[11px] leading-relaxed text-ink-muted">
              {entry.example}
            </span>
          )}
          {entry.href && (
            <Link
              href={entry.href}
              className="mt-2.5 block text-[11px] font-medium text-accent hover:underline"
            >
              {entry.hrefLabel ?? "Voir la page"} →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
