"use client";

import * as React from "react";
import { cx } from "@/components/ui";
import { STATUS } from "@/lib/viz/palette";

export interface Cause {
  key: string;
  /** How the control is named in the sentence: "K", "la profondeur", "λ". */
  label: string;
  value: number | string;
  format?: (v: number | string) => string;
  /** Grammatical gender, so "augmenté"/"passé" agree in French. */
  feminine?: boolean;
}

export interface Effect {
  key: string;
  label: string;
  value: number;
  format?: (v: number) => string;
  /** Which direction is an improvement. Omit when neither is. */
  better?: "up" | "down";
  /** Ignore changes smaller than this — noise should not be narrated. */
  epsilon?: number;
}

interface Snapshot {
  causes: Record<string, number | string>;
  effects: Record<string, number>;
}

/**
 * Says, in plain French, what the learner's last action changed.
 *
 * The site is full of numbers that move when you move a slider; the gap it
 * fills is the sentence a teacher would say next to you — "you raised K from 5
 * to 12, the boundary smoothed out and there are three fewer errors". Reading
 * a consequence you caused is a far stronger way to learn a relationship than
 * reading it stated in a paragraph.
 *
 * It waits for the numbers to settle before speaking. Model fits are
 * asynchronous, so the cause (the slider) changes a beat before the effects
 * (accuracy, errors); narrating immediately would describe the new K with the
 * old accuracy — confidently, and wrongly.
 */
export function Narrator({
  causes,
  effects,
  settleMs = 450,
  className,
  placeholder = "Bougez un réglage : ce qui change sera décrit ici.",
}: {
  causes: Cause[];
  effects: Effect[];
  settleMs?: number;
  className?: string;
  placeholder?: string;
}) {
  const current = React.useMemo<Snapshot>(
    () => ({
      causes: Object.fromEntries(causes.map((c) => [c.key, c.value])),
      effects: Object.fromEntries(effects.map((e) => [e.key, e.value])),
    }),
    [causes, effects],
  );

  const [stable, setStable] = React.useState<Snapshot | null>(null);
  const [sentence, setSentence] = React.useState<{
    text: React.ReactNode;
    tone: "neutral" | "good" | "bad";
  } | null>(null);
  const stableRef = React.useRef<Snapshot | null>(null);

  const signature = JSON.stringify(current);

  React.useEffect(() => {
    const id = window.setTimeout(() => setStable(current), settleMs);
    return () => window.clearTimeout(id);
    // `signature` is the real dependency: a fresh object each render would
    // restart the timer forever and the narrator would never speak.
  }, [signature, settleMs]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!stable) return;
    const previous = stableRef.current;
    stableRef.current = stable;
    if (!previous) return;

    const changedCause = causes.find(
      (c) => previous.causes[c.key] !== undefined && previous.causes[c.key] !== stable.causes[c.key],
    );
    if (!changedCause) return;

    const moved = effects
      .map((e) => {
        const before = previous.effects[e.key];
        const after = stable.effects[e.key];
        if (before === undefined || after === undefined) return null;
        const delta = after - before;
        if (Math.abs(delta) <= (e.epsilon ?? 1e-9)) return null;
        return { e, before, after, delta };
      })
      .filter(Boolean) as { e: Effect; before: number; after: number; delta: number }[];

    const fmtCause = (v: number | string) =>
      changedCause.format ? changedCause.format(v) : String(v);
    const from = fmtCause(previous.causes[changedCause.key]);
    const to = fmtCause(stable.causes[changedCause.key]);
    const numeric =
      typeof previous.causes[changedCause.key] === "number" &&
      typeof stable.causes[changedCause.key] === "number";
    const rose = numeric && (stable.causes[changedCause.key] as number) > (previous.causes[changedCause.key] as number);
    const verb = numeric
      ? rose
        ? changedCause.feminine ? "augmentée" : "augmenté"
        : changedCause.feminine ? "réduite" : "réduit"
      : "changé";

    let tone: "neutral" | "good" | "bad" = "neutral";
    const scored = moved.filter((m) => m.e.better);
    if (scored.length) {
      const improved = scored.filter((m) =>
        m.e.better === "up" ? m.delta > 0 : m.delta < 0,
      ).length;
      tone = improved > scored.length / 2 ? "good" : improved === 0 ? "bad" : "neutral";
    }

    setSentence({
      tone,
      text: (
        <>
          Vous avez {verb} <strong className="text-ink">{changedCause.label}</strong>
          {numeric ? (
            <>
              {" "}
              de <span className="tnum">{from}</span> à <span className="tnum">{to}</span>
            </>
          ) : (
            <>
              {" "}
              pour <span className="tnum">{to}</span>
            </>
          )}
          {moved.length === 0 ? (
            <> — et rien n&apos;a bougé dans les mesures.</>
          ) : (
            <>
              {" : "}
              {moved.map((m, i) => {
                const f = m.e.format ?? ((v: number) => v.toFixed(2));
                const good = m.e.better
                  ? m.e.better === "up"
                    ? m.delta > 0
                    : m.delta < 0
                  : null;
                return (
                  <React.Fragment key={m.e.key}>
                    {i > 0 && (i === moved.length - 1 ? " et " : ", ")}
                    {m.e.label} passe de <span className="tnum">{f(m.before)}</span> à{" "}
                    <span
                      className="tnum font-semibold"
                      style={{
                        color:
                          good === null ? undefined : good ? STATUS.good : STATUS.critical,
                      }}
                    >
                      {f(m.after)}
                    </span>
                  </React.Fragment>
                );
              })}
              .
            </>
          )}
        </>
      ),
    });
  }, [stable]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      aria-live="polite"
      className={cx(
        "rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed transition-colors",
        sentence?.tone === "good"
          ? "border-good/30 bg-good/[0.06] text-ink-2"
          : sentence?.tone === "bad"
            ? "border-warning/30 bg-warning/[0.06] text-ink-2"
            : "border-line bg-surface-2/50 text-ink-2",
        className,
      )}
    >
      <span className="mr-1.5 select-none text-ink-muted" aria-hidden>
        ⌁
      </span>
      {sentence ? sentence.text : <span className="text-ink-muted">{placeholder}</span>}
    </div>
  );
}
