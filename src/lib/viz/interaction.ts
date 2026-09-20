/**
 * A single global flag: "the learner is currently manipulating a plot".
 *
 * Deliberately a module-level store rather than React state or context. It is
 * written on every pointerdown/up and read by unrelated subtrees; routing that
 * through context would re-render the whole page at the exact moment the page
 * must not re-render.
 *
 * Its one consumer today is the 3-D canvas, which stops drawing entirely while
 * a drag is in progress. A WebGL frame costs far more than an SVG update, and
 * during a drag the 3-D panel is the least important thing on screen.
 */
let active = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export const plotInteraction = {
  /** Call on pointerdown. Nested/overlapping interactions are counted. */
  begin(): void {
    active += 1;
    if (active === 1) notify();
  },
  /** Call on pointerup, pointercancel and pointerleave. */
  end(): void {
    if (active === 0) return;
    active -= 1;
    if (active === 0) notify();
  },
  isActive(): boolean {
    return active > 0;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot(): boolean {
    return active > 0;
  },
  /** Server render: never interacting. */
  getServerSnapshot(): boolean {
    return false;
  },
};
