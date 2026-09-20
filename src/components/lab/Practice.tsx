"use client";

import * as React from "react";
import { Button, cx } from "@/components/ui";
import { useLocalState, useSeenFlag } from "@/lib/hooks/useLocalState";
import { STATUS } from "@/lib/viz/palette";

/**
 * Commit to a prediction before looking.
 *
 * Reading "a large K smooths the boundary" and agreeing with it feels like
 * learning and mostly is not. Being asked first, getting it wrong, and *then*
 * seeing the boundary is a different experience entirely — the surprise is what
 * does the work, and there is no surprise without a commitment.
 *
 * It deliberately hides nothing on the page: a curtain over the visualisation
 * would punish the reader who already knows, and the site is also a reference.
 * What is withheld is only the answer to its own question.
 */
export function PredictFirst({
  id,
  question,
  options,
  answer,
  explanation,
  className,
}: {
  /** Stable across visits, so an answered prediction stays answered. */
  id: string;
  question: React.ReactNode;
  options: string[];
  answer: number;
  explanation: React.ReactNode;
  className?: string;
}) {
  const [picked, setPicked] = useLocalState<number | null>(`predict.${id}`, null, null);
  const done = picked !== null;
  const right = picked === answer;

  return (
    <section
      className={cx(
        "rounded-xl border px-4 py-3.5",
        done
          ? right
            ? "border-good/35 bg-good/[0.05]"
            : "border-warning/35 bg-warning/[0.05]"
          : "border-accent/35 bg-accent/[0.05]",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
        <span aria-hidden>◆</span> Devinez d&apos;abord
      </p>
      <p className="text-[13px] leading-relaxed text-ink">{question}</p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const reveal = done && (i === picked || i === answer);
          return (
            <button
              key={opt}
              onClick={() => !done && setPicked(i)}
              disabled={done}
              className={cx(
                "rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                reveal && i === answer
                  ? "border-good/50 bg-good/[0.1] text-ink"
                  : reveal
                    ? "border-critical/50 bg-critical/[0.08] text-ink"
                    : done
                      ? "border-line bg-surface-2/30 text-ink-muted"
                      : "border-line bg-surface-2/60 text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {done && i === answer && <span aria-hidden className="mr-1.5">✓</span>}
              {done && i === picked && i !== answer && <span aria-hidden className="mr-1.5">✕</span>}
              {opt}
            </button>
          );
        })}
      </div>

      {done && (
        <p className="mt-3 border-t border-line pt-2.5 text-[12.5px] leading-relaxed text-ink-2">
          <strong className="text-ink">
            {right ? "Bien vu. " : "Pas celle-là. "}
          </strong>
          {explanation}
        </p>
      )}
    </section>
  );
}

/**
 * A number to compute by hand, checked.
 *
 * Choosing between four options can be done by elimination; producing a number
 * cannot. This is the only kind of exercise on the site that a reader can fail
 * without having any idea which answer was expected, which is exactly why it is
 * worth more than three multiple-choice questions.
 *
 * The worked steps appear one at a time, on demand: a reader who is stuck gets
 * unstuck without being handed the answer, and the reader who is not stuck is
 * never shown it.
 */
export function NumericExercise({
  id,
  prompt,
  answer,
  tolerance = 0.01,
  unit,
  steps,
  className,
}: {
  id: string;
  prompt: React.ReactNode;
  answer: number;
  /** Absolute tolerance. Generous enough for hand arithmetic, tight enough to
   *  distinguish a right method from a wrong one. */
  tolerance?: number;
  unit?: string;
  /** The worked solution, revealed one line at a time. */
  steps: React.ReactNode[];
  className?: string;
}) {
  const [value, setValue] = React.useState("");
  const [checked, setChecked] = React.useState<null | boolean>(null);
  const [shown, setShown] = React.useState(0);
  const [solved, markSolved] = useSeenFlag(`exercise.${id}`);

  const check = () => {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setChecked(false);
      return;
    }
    const ok = Math.abs(parsed - answer) <= tolerance;
    setChecked(ok);
    if (ok) markSolved();
  };

  return (
    <section className={cx("rounded-xl border border-line bg-surface-1/70 p-4", className)}>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        <span aria-hidden>∑</span> À calculer vous-même
        {solved && (
          <span className="font-normal normal-case tracking-normal" style={{ color: STATUS.good }}>
            · déjà résolu
          </span>
        )}
      </p>
      <div className="text-[13px] leading-relaxed text-ink">{prompt}</div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChecked(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") check();
          }}
          placeholder="votre réponse"
          aria-label="Votre réponse"
          className={cx(
            "tnum w-36 rounded-lg border bg-surface-2/60 px-3 py-1.5 text-[13px] text-ink outline-none transition-colors",
            checked === true
              ? "border-good/60"
              : checked === false
                ? "border-critical/60"
                : "border-line focus:border-accent/60",
          )}
        />
        {unit && <span className="text-[12px] text-ink-muted">{unit}</span>}
        <Button onClick={check} size="sm">
          Vérifier
        </Button>
        {shown < steps.length && (
          <Button variant="ghost" size="sm" onClick={() => setShown((s) => s + 1)}>
            {shown === 0 ? "Un indice" : "Étape suivante"}
          </Button>
        )}
      </div>

      {checked !== null && (
        <p
          className="mt-2 text-[12.5px]"
          style={{ color: checked ? STATUS.good : STATUS.critical }}
        >
          {checked
            ? "C'est ça."
            : value.trim() === ""
              ? "Entrez un nombre."
              : "Pas encore. Regardez un indice plutôt que de deviner."}
        </p>
      )}

      {shown > 0 && (
        <ol className="mt-3 space-y-1.5 border-t border-line pt-2.5">
          {steps.slice(0, shown).map((step, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <span className="tnum shrink-0 text-ink-muted">{i + 1}.</span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
          {shown >= steps.length && checked !== true && (
            <li className="pt-1 text-[12.5px] text-ink">
              Réponse : <strong className="tnum">{answer}</strong>
              {unit ? ` ${unit}` : ""}.
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
