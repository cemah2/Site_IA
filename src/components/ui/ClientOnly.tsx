"use client";

import * as React from "react";

/**
 * Render children in the browser only.
 *
 * Needed because the labs render numbers derived from the dataset, and the
 * dataset itself is not bit-identical between the build machine and the
 * visitor's browser: `Math.log`, `Math.exp` and `Math.cos` are not required by
 * the ECMAScript spec to be correctly rounded, so two engines may differ in the
 * last bits. Those differences reach the DOM as `0.4142135623730951` vs
 * `0.41421356237309503`, React sees a hydration mismatch and discards the whole
 * subtree.
 *
 * The prose, headings and metadata around the workbench still render on the
 * server; only the live numbers wait for the client.
 */
const noopSubscribe = () => () => {};

export function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  // useSyncExternalStore with differing server/client snapshots is the
  // effect-free way to ask "am I in the browser yet?" — no cascading render,
  // and React treats the two values as intentionally different rather than as
  // a mismatch to repair.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return <>{mounted ? children : fallback}</>;
}

/** Neutral placeholder matching the workbench's shape. */
export function WorkbenchSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" aria-hidden>
      <div className="aspect-square w-full animate-pulse rounded-xl border border-line bg-surface-1/60" />
      <div className="h-[460px] animate-pulse rounded-xl border border-line bg-surface-1/60" />
    </div>
  );
}
