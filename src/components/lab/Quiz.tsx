"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { findNav } from "@/lib/nav";
import { recordAnswer } from "@/lib/progress/quiz-log";
import { STATUS } from "@/lib/viz/palette";

export interface QuizQuestion {
  id: string;
  /** Plain text, so the question can be asked again on the revision page. */
  question: string;
  options: { id: string; label: string }[];
  /** Index into `options`. */
  answer: number;
  /** Shown after answering, whatever the answer. Explains *why*. */
  explanation: React.ReactNode;
}

/**
 * Two or three questions at the end of a page, corrected instantly.
 *
 * The point is not scoring: it is that trying to answer forces a reader to
 * commit to a belief, which is what turns "I followed that" into "I can use
 * that". So the explanation is shown to everyone, right or wrong, and a wrong
 * answer can be changed — nothing is locked or graded.
 *
 * Questions here are written to be answerable *from the visualisation above*,
 * not from memory of a definition.
 */
export function Quiz({
  questions,
  title = "Vérifiez que c'est passé",
}: {
  questions: QuizQuestion[];
  title?: string;
}) {
  const [picked, setPicked] = React.useState<Record<string, number>>({});
  const answered = questions.filter((q) => picked[q.id] !== undefined).length;
  const correct = questions.filter((q) => picked[q.id] === q.answer).length;

  const pathname = usePathname();
  const href = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const pageTitle = findNav(href)?.item.label ?? href;

  // Answering is what schedules the question for review. Only the first answer
  // to a question counts: changing your mind after seeing the correction is
  // allowed — it is how the page teaches — but it is not retrieval, so it must
  // not be allowed to promote a question you actually missed.
  const logged = React.useRef(new Set<string>());
  const choose = (q: QuizQuestion, index: number) => {
    setPicked((p) => ({ ...p, [q.id]: index }));
    if (logged.current.has(q.id)) return;
    logged.current.add(q.id);
    recordAnswer({
      qid: `${href}#${q.id}`,
      href,
      pageTitle,
      question: q.question,
      options: q.options.map((o) => o.label),
      answer: q.answer,
      correct: index === q.answer,
    });
  };

  return (
    <section className="rounded-xl border border-line bg-surface-1/70">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="tnum text-[11px] text-ink-muted">
          {answered === 0
            ? `${questions.length} question${questions.length > 1 ? "s" : ""}`
            : `${correct} / ${questions.length}`}
        </span>
      </header>
      {answered > 0 && (
        <p className="border-b border-line bg-surface-2/40 px-4 py-2 text-[11px] leading-snug text-ink-muted">
          Ces questions reviendront sur la page{" "}
          <a href="/reviser/" className="text-accent hover:underline">
            réviser
          </a>{" "}
          — tout de suite si vous vous êtes trompé, dans quelques jours sinon.
        </p>
      )}

      <div className="divide-y divide-line">
        {questions.map((q, qi) => {
          const choice = picked[q.id];
          const done = choice !== undefined;
          return (
            <div key={q.id} className="p-4">
              <p className="text-[13.5px] leading-relaxed text-ink">
                <span className="mr-1.5 text-ink-muted">{qi + 1}.</span>
                {q.question}
              </p>

              <ul className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isPicked = choice === oi;
                  const isAnswer = oi === q.answer;
                  const reveal = done && (isPicked || isAnswer);
                  return (
                    <li key={opt.id}>
                      <button
                        onClick={() => choose(q, oi)}
                        aria-pressed={isPicked}
                        className={cx(
                          "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                          reveal && isAnswer
                            ? "border-good/45 bg-good/[0.08] text-ink"
                            : reveal && isPicked
                              ? "border-critical/45 bg-critical/[0.07] text-ink"
                              : "border-line bg-surface-2/40 text-ink-2 hover:border-line-strong hover:text-ink",
                        )}
                      >
                        <span
                          aria-hidden
                          className="mt-px w-3.5 shrink-0 text-center text-[11px]"
                          style={{
                            color: reveal
                              ? isAnswer
                                ? STATUS.good
                                : isPicked
                                  ? STATUS.critical
                                  : undefined
                              : undefined,
                          }}
                        >
                          {reveal ? (isAnswer ? "✓" : "✕") : String.fromCharCode(97 + oi)}
                        </span>
                        <span className="min-w-0">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {done && (
                <div className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                  <strong className="text-ink">
                    {choice === q.answer ? "Exact. " : "Pas tout à fait. "}
                  </strong>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
