"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell, SectionTitle } from "@/components/layout/PageShell";
import { Button, Callout, Panel, Stat } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import {
  allRecords,
  dueRecords,
  forgetAll,
  INTERVALS,
  intervalLabel,
  practiceRecords,
  recordAnswer,
  subscribeQuizLog,
  summarise,
  type QuizRecord,
} from "@/lib/progress/quiz-log";
import { STATUS } from "@/lib/viz/palette";

export function ReviewLab() {
  return (
    <PageShell
      eyebrow="Commencer"
      title="Réviser"
      lede={
        <>
          Une question à laquelle vous avez répondu une fois est oubliée une semaine plus tard.
          Y répondre <strong>à nouveau, plus tard</strong>, ne l&apos;est pas — c&apos;est
          l&apos;effet le mieux établi de tout l&apos;apprentissage. Cette page vous ressert les
          questions du site au moment où elles commencent à s&apos;effacer.
        </>
      }
    >
      <ClientOnly
        fallback={<div className="h-[380px] animate-pulse rounded-xl border border-line bg-surface-1/60" />}
      >
        <ReviewSession />
      </ClientOnly>
    </PageShell>
  );
}

function ReviewSession() {
  // The log lives outside React — it is written by quizzes on other pages and
  // read here — so it is subscribed to rather than copied into state.
  const version = React.useSyncExternalStore(
    subscribeQuizLog,
    () => allRecordsSignature(),
    () => "",
  );
  void version;

  const [now] = React.useState(() => Date.now());
  const [queue, setQueue] = React.useState<QuizRecord[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [done, setDone] = React.useState(0);

  const stats = summarise(now);
  const all = allRecords();

  const start = (records: QuizRecord[]) => {
    setQueue(records.slice(0, 12));
    setIndex(0);
    setPicked(null);
    setDone(0);
  };
  const practice = practiceRecords(now);

  if (!all.length) {
    return (
      <Callout kind="note" title="Rien à réviser pour l'instant">
        Répondez aux questions en bas des pages du site : elles arriveront ici toutes seules.
        Commencez par <Link href="/parcours/" className="text-accent hover:underline">le parcours guidé</Link>,
        ou par n&apos;importe quelle page d&apos;algorithme.
      </Callout>
    );
  }

  const current = queue?.[index] ?? null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Questions vues" value={stats.total} />
        <Stat
          label="À revoir maintenant"
          value={stats.due}
          tone={stats.due > 0 ? "warning" : "good"}
        />
        <Stat label="Bien ancrées" value={stats.learned} tone="good" hint="Vues juste plusieurs fois" />
        <Stat
          label="Encore fragiles"
          value={stats.shaky}
          tone={stats.shaky > 0 ? "critical" : "neutral"}
          hint="Ratées au moins une fois"
        />
      </div>

      {!queue && (
        <Panel
          title={stats.due ? `${stats.due} question${stats.due > 1 ? "s" : ""} vous attendent` : "Tout est à jour"}
          subtitle={
            stats.due
              ? "Une dizaine à la fois — au-delà, on répond sans réfléchir."
              : "Revenez plus tard : les questions reviennent selon leur ancienneté."
          }
        >
          {stats.due > 0 ? (
            <Button variant="primary" onClick={() => start(dueRecords(now))}>
              Commencer la révision
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Rien n&apos;est dû aujourd&apos;hui — la prochaine question revient{" "}
                {nextDueLabel(all, now)}. Respecter l&apos;attente est ce qui rend la méthode
                efficace : réviser trop tôt donne l&apos;impression de savoir sans rien ancrer.
              </p>
              {practice.length > 0 && (
                <Button onClick={() => start(practice)}>
                  Réviser quand même {Math.min(practice.length, 12)} question
                  {practice.length > 1 ? "s" : ""} pas encore solide
                  {practice.length > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}
        </Panel>
      )}

      {queue && current && (
        <Panel
          title={`Question ${index + 1} sur ${queue.length}`}
          subtitle={
            <>
              vue {current.attempts} fois · {current.mistakes} erreur
              {current.mistakes > 1 ? "s" : ""} ·{" "}
              <Link href={current.href} className="text-accent hover:underline">
                {current.pageTitle}
              </Link>
            </>
          }
        >
          <p className="text-[13.5px] leading-relaxed text-ink">{current.question}</p>
          <ul className="mt-3 space-y-1.5">
            {current.options.map((opt, oi) => {
              const reveal = picked !== null && (oi === picked || oi === current.answer);
              const isAnswer = oi === current.answer;
              return (
                <li key={oi}>
                  <button
                    onClick={() => {
                      if (picked !== null) return;
                      setPicked(oi);
                      recordAnswer({
                        qid: current.qid,
                        href: current.href,
                        pageTitle: current.pageTitle,
                        question: current.question,
                        options: current.options,
                        answer: current.answer,
                        correct: oi === current.answer,
                      });
                      setDone((d) => d + (oi === current.answer ? 1 : 0));
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                      reveal && isAnswer
                        ? "border-good/45 bg-good/[0.08] text-ink"
                        : reveal
                          ? "border-critical/45 bg-critical/[0.07] text-ink"
                          : "border-line bg-surface-2/40 text-ink-2 hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="mt-px w-3.5 shrink-0 text-center text-[11px]"
                      style={{
                        color: reveal ? (isAnswer ? STATUS.good : STATUS.critical) : undefined,
                      }}
                    >
                      {reveal ? (isAnswer ? "✓" : "✕") : String.fromCharCode(97 + oi)}
                    </span>
                    <span className="min-w-0">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {picked !== null && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                <strong className="text-ink">
                  {picked === current.answer ? "Exact. " : "Raté. "}
                </strong>
                {picked === current.answer
                  ? `Cette question ${intervalLabel(Math.min(INTERVALS.length - 1, current.box + 1))}.`
                  : "Elle revient tout de suite en fin de session."}{" "}
                L&apos;explication complète est sur la page{" "}
                <Link href={current.href} className="text-accent hover:underline">
                  {current.pageTitle}
                </Link>
                .
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setPicked(null);
                  if (index + 1 < queue.length) setIndex(index + 1);
                  else setQueue([]);
                }}
              >
                {index + 1 < queue.length ? "Question suivante" : "Terminer"}
              </Button>
            </div>
          )}
        </Panel>
      )}

      {queue && !current && (
        <Callout kind="insight" title={`Session terminée — ${done} sur ${queue.length}`}>
          {done === queue.length
            ? "Tout juste. Ces questions ne reviendront pas avant un moment."
            : "Les questions ratées reviennent dans dix minutes, pendant que l'explication est encore fraîche."}{" "}
          <span className="mt-2 block">
            <Button onClick={() => setQueue(null)}>Revenir au tableau</Button>
          </span>
        </Callout>
      )}

      <SectionTitle hint="Ce que la page fait de vos réponses.">Comment ça marche</SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Panel title="Le calendrier, en clair">
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Chaque question occupe une case. Une bonne réponse la fait monter d&apos;une case et
            repousse son retour ; une mauvaise la renvoie à la première. Les délais sont fixes et
            affichés, pour que vous puissiez voir la règle plutôt que faire confiance à une
            boîte noire.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTERVALS.map((days, box) => (
              <div
                key={box}
                className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[11px]"
              >
                <div className="font-medium text-ink">Case {box}</div>
                <div className="tnum text-ink-muted">
                  {days === 0 ? "10 minutes" : days === 1 ? "1 jour" : `${days} jours`}
                </div>
                <div className="tnum mt-0.5 text-ink-2">
                  {allRecords().filter((r) => r.box === box).length} question(s)
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-snug text-ink-muted">
            Tout est stocké dans votre navigateur, rien n&apos;est envoyé nulle part. Changer
            d&apos;ordinateur ou vider les données du site remet le compteur à zéro.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Ce qui résiste le plus" subtitle="Vos questions les plus ratées">
            {all.filter((r) => r.mistakes > 0).length ? (
              <ul className="space-y-2">
                {all
                  .filter((r) => r.mistakes > 0)
                  .sort((a, b) => b.mistakes - a.mistakes)
                  .slice(0, 5)
                  .map((r) => (
                    <li key={r.qid} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                      <Link href={r.href} className="text-[11.5px] font-medium text-accent hover:underline">
                        {r.pageTitle}
                      </Link>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
                        {r.question.length > 110 ? `${r.question.slice(0, 110)}…` : r.question}
                      </p>
                      <p className="tnum mt-1 text-[10.5px] text-ink-muted">
                        {r.mistakes} erreur{r.mistakes > 1 ? "s" : ""} sur {r.attempts} passages
                      </p>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-muted">
                Aucune question ratée pour l&apos;instant.
              </p>
            )}
          </Panel>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              if (window.confirm("Effacer tout votre historique de révision ?")) forgetAll();
            }}
          >
            Effacer mon historique
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Cheap signature so `useSyncExternalStore` can tell the log changed. */
function allRecordsSignature(): string {
  const all = allRecords();
  return `${all.length}:${all.reduce((a, r) => a + r.attempts + r.box, 0)}`;
}

function nextDueLabel(records: QuizRecord[], now: number): string {
  const future = records.filter((r) => r.due > now).sort((a, b) => a.due - b.due)[0];
  if (!future) return "bientôt";
  const days = Math.ceil((future.due - now) / 86_400_000);
  if (days <= 0) return "dans quelques minutes";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}
