"use client";

import * as React from "react";
import { Button, cx } from "@/components/ui";
import { useSeenFlag } from "@/lib/hooks/useLocalState";

export interface TourStep {
  /** A `data-tour` value on the element to highlight. */
  target: string;
  title: string;
  body: React.ReactNode;
  /** Nudge the learner to actually do something before continuing. */
  action?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * A first-visit walkthrough that points at the real interface.
 *
 * Deliberately not a slideshow of screenshots: each step spotlights a live
 * control and asks the learner to use it. Someone who has moved a point and
 * watched the boundary follow has learnt more than someone who has read three
 * paragraphs about it.
 *
 * It runs once, remembers that it ran, and can be replayed on demand. A tour
 * that reappears on every visit is an obstacle, not an onboarding.
 */
export function Tour({
  id,
  steps,
  autoStart = true,
}: {
  id: string;
  steps: TourStep[];
  autoStart?: boolean;
}) {
  const [seen, markSeen] = useSeenFlag(`tour.${id}`);
  const [running, setRunning] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  // Start only after mount, and only if it has never run: the server snapshot
  // of `seen` is `true`, so nothing flashes into the pre-rendered HTML.
  React.useEffect(() => {
    if (autoStart && !seen) {
      const id = window.setTimeout(() => setRunning(true), 900);
      return () => window.clearTimeout(id);
    }
  }, [autoStart, seen]);

  React.useEffect(() => {
    const handler = () => {
      setIndex(0);
      setRunning(true);
    };
    window.addEventListener("mllab:tour", handler);
    return () => window.removeEventListener("mllab:tour", handler);
  }, []);

  const step = steps[index];

  const measure = React.useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  React.useEffect(() => {
    if (!running || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const id = window.setTimeout(measure, 420);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [running, step, measure]);

  const finish = React.useCallback(() => {
    setRunning(false);
    markSeen();
  }, [markSeen]);

  React.useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, finish, steps.length]);

  if (!running || !step) return null;

  const pad = 8;
  const hole = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const placement = placeCard(hole);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Visite guidée">
      {/* The spotlight: one element whose huge outward shadow dims everything
          except its own box. Cheaper and crisper than four overlay strips. */}
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(8, 11, 18, 0.82)",
            outline: "2px solid rgba(122, 162, 255, 0.85)",
            outlineOffset: 2,
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-plane/85" />
      )}

      <div
        className="absolute w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface-2 p-4 shadow-2xl"
        style={{ top: placement.top, left: placement.left }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-ink">{step.title}</h2>
          <span className="tnum shrink-0 text-[11px] text-ink-muted">
            {index + 1} / {steps.length}
          </span>
        </div>
        <div className="mt-2 text-[13px] leading-relaxed text-ink-2">{step.body}</div>
        {step.action && (
          <p className="mt-2.5 rounded-lg border border-accent/30 bg-accent/[0.07] px-2.5 py-2 text-[12px] leading-relaxed text-ink">
            <span className="mr-1.5 text-accent" aria-hidden>
              →
            </span>
            {step.action}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={finish}>
            Passer
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              index === steps.length - 1 ? finish() : setIndex((i) => i + 1)
            }
          >
            {index === steps.length - 1 ? "Terminer" : "Suivant →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const CARD_W = 416;
const CARD_H = 250;
const GAP = 14;

/**
 * Where to put the explanation card so it never falls off screen and never
 * covers what it is pointing at.
 *
 * The hard case is a spotlight taller than the viewport's usable height — a
 * full-size plot — where neither "above" nor "below" fits. The card then goes
 * beside the highlight, on whichever side has more room, which is exactly what
 * a person would do with a sticky note.
 */
function placeCard(hole: Rect | null): { top: number; left: number } {
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const clamp = (v: number, max: number) => Math.max(GAP, Math.min(v, max));

  if (!hole) return { top: GAP * 4, left: GAP };

  const roomBelow = vh - (hole.top + hole.height) - GAP;
  const roomAbove = hole.top - GAP;
  const roomRight = vw - (hole.left + hole.width) - GAP;
  const roomLeft = hole.left - GAP;

  if (roomBelow >= CARD_H) {
    return {
      top: hole.top + hole.height + GAP,
      left: clamp(hole.left, vw - CARD_W - GAP),
    };
  }
  if (roomAbove >= CARD_H) {
    return { top: hole.top - CARD_H - GAP, left: clamp(hole.left, vw - CARD_W - GAP) };
  }
  // Beside it: the highlight is too tall for either band.
  const side = roomRight >= roomLeft ? hole.left + hole.width + GAP : hole.left - CARD_W - GAP;
  return {
    top: clamp(hole.top + hole.height / 2 - CARD_H / 2, vh - CARD_H - GAP),
    left: clamp(side, vw - CARD_W - GAP),
  };
}

/** Restart the tour from anywhere. */
export function TourButton({ className, children = "Revoir la visite guidée" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("mllab:tour"))}
      className={cx(
        "text-[12px] font-medium text-accent transition-colors hover:underline",
        className,
      )}
    >
      {children}
    </button>
  );
}
