"use client";

import * as React from "react";
import { readHashParams } from "@/lib/permalink";

/**
 * Apply settings from a shared link, once, after the first paint.
 *
 * Reading the fragment inside a `useState` initialiser would be simpler and is
 * wrong: this site is pre-rendered at build time, where there is no fragment,
 * so the server's markup and the client's first render would disagree and React
 * would throw the subtree away. Applying it in an effect costs one extra render
 * and keeps hydration honest.
 *
 * The update is queued rather than run inline so the page paints its defaults
 * first — a shared link should look like the page arriving, not like the page
 * arriving and then jumping.
 */
export function useSharedInit(apply: (params: URLSearchParams) => void): void {
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    queueMicrotask(() => apply(readHashParams()));
    // Deliberately one-shot: `apply` is a fresh closure on every render, and
    // listing it here would re-apply the link's values each time the reader
    // touched a control — turning a starting point into a cage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
