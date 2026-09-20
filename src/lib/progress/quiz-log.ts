/**
 * What you answered, and when to ask you again.
 *
 * The quizzes on this site are good at the moment you read a page and useless
 * a week later, which is the normal fate of anything read once. Bringing a
 * missed question back after a delay — retrieval practice, spaced — is the
 * single best-evidenced thing a learning tool can do, and it costs one small
 * record per question.
 *
 * A plain Leitner schedule rather than a tuned algorithm: the intervals are
 * printed in the interface, so the reader can see the rule instead of trusting
 * a black box. Answer right, the question moves to the next box and comes back
 * later; answer wrong, it goes straight back to the first.
 */

const KEY = "mllab.quiz";
const VERSION = 1;

/** Days before a question in each box comes back. */
export const INTERVALS = [0, 1, 3, 7, 21, 60];

export interface QuizRecord {
  /** Unique across the site: page path + the question's own id. */
  qid: string;
  href: string;
  pageTitle: string;
  question: string;
  options: string[];
  answer: number;
  /** Leitner box, 0 … 5. */
  box: number;
  /** Epoch milliseconds. */
  due: number;
  lastSeen: number;
  attempts: number;
  mistakes: number;
}

interface Store {
  version: number;
  records: Record<string, QuizRecord>;
}

const listeners = new Set<() => void>();
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  const empty: Store = { version: VERSION, records: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return (cache = empty);
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || parsed.version !== VERSION || typeof parsed.records !== "object") {
      return (cache = empty);
    }
    cache = parsed;
    return cache;
  } catch {
    return (cache = empty);
  }
}

function write(store: Store): void {
  cache = store;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Full or unavailable storage costs the schedule, never the page.
  }
  for (const fn of listeners) fn();
}

export function subscribeQuizLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function allRecords(): QuizRecord[] {
  return Object.values(read().records);
}

/** Questions whose next review has come around. */
export function dueRecords(now = Date.now()): QuizRecord[] {
  return allRecords()
    .filter((r) => r.due <= now)
    .sort((a, b) => a.box - b.box || a.due - b.due);
}

export interface RecordInput {
  qid: string;
  href: string;
  pageTitle: string;
  question: string;
  options: string[];
  answer: number;
  correct: boolean;
}

export function recordAnswer(input: RecordInput, now = Date.now()): void {
  const store = read();
  const existing = store.records[input.qid];
  const box = input.correct ? Math.min(INTERVALS.length - 1, (existing?.box ?? 0) + 1) : 0;
  const next: QuizRecord = {
    qid: input.qid,
    href: input.href,
    pageTitle: input.pageTitle,
    question: input.question,
    options: input.options,
    answer: input.answer,
    box,
    // A missed question is due immediately. Delaying it by even ten minutes
    // meant that answering a quiz and then opening the revision page showed
    // nothing at all — which reads as a broken feature rather than as a
    // schedule, and loses the reader on their first visit.
    due: box === 0 ? now : now + INTERVALS[box] * 86_400_000,
    lastSeen: now,
    attempts: (existing?.attempts ?? 0) + 1,
    mistakes: (existing?.mistakes ?? 0) + (input.correct ? 0 : 1),
  };
  write({ ...store, records: { ...store.records, [input.qid]: next } });
}

/** Questions worth practising even when nothing is formally due. */
export function practiceRecords(now = Date.now()): QuizRecord[] {
  return allRecords()
    .filter((r) => r.box < 4)
    .sort((a, b) => a.box - b.box || b.mistakes - a.mistakes || a.due - b.due)
    .filter((r) => r.due > now);
}

export function forgetAll(): void {
  write({ version: VERSION, records: {} });
}

export interface QuizSummary {
  total: number;
  due: number;
  learned: number;
  shaky: number;
}

export function summarise(now = Date.now()): QuizSummary {
  const all = allRecords();
  return {
    total: all.length,
    due: all.filter((r) => r.due <= now).length,
    learned: all.filter((r) => r.box >= 4).length,
    shaky: all.filter((r) => r.mistakes > 0 && r.box < 3).length,
  };
}

/** How the next review is phrased, from a box number. */
export function intervalLabel(box: number): string {
  if (box === 0) return "revient dès maintenant";
  const days = INTERVALS[Math.min(box, INTERVALS.length - 1)];
  if (days === 1) return "revient demain";
  if (days < 30) return `revient dans ${days} jours`;
  return `revient dans ${Math.round(days / 30)} mois`;
}
