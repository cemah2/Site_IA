"use client";

import * as React from "react";

/**
 * Persisted UI preferences, read through `useSyncExternalStore`.
 *
 * `localStorage` is external state, so modelling it as external state is both
 * accurate and what avoids the "setState inside an effect" cascade that a naive
 * read-on-mount produces. The server snapshot is the *already-seen* value for
 * flags, so nothing one-time — a tour, an annotation — is ever rendered into
 * the HTML and then yanked away on hydration.
 *
 * Every access is wrapped: `localStorage` throws in private mode and with site
 * data blocked, and a lost preference must never break the page holding it.
 */

const listeners = new Set<() => void>();
/** Snapshots must be referentially stable between notifications. */
const cache = new Map<string, unknown>();

function notify() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Another tab changing the same key should update this one too.
  const onStorage = () => {
    cache.clear();
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    value = fallback;
  }
  cache.set(key, value);
  return value;
}

function write<T>(key: string, value: T): void {
  cache.set(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* preference simply not remembered */
  }
  notify();
}

export function useLocalState<T>(
  key: string,
  fallback: T,
  /** Value to assume during server rendering. */
  serverValue: T = fallback,
): [T, (value: T | ((previous: T) => T)) => void] {
  const fullKey = `mllab.${key}`;

  const value = React.useSyncExternalStore(
    subscribe,
    () => read(fullKey, fallback),
    () => serverValue,
  );

  const set = React.useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (previous: T) => T)(read(fullKey, fallback))
          : next;
      write(fullKey, resolved);
    },
    [fullKey, fallback],
  );

  return [value, set];
}

/**
 * A one-time flag ("already seen"). The server value is `true` so that
 * one-shot UI never flashes into the pre-rendered HTML.
 */
export function useSeenFlag(key: string): [boolean, () => void] {
  const [seen, setSeen] = useLocalState<boolean>(`seen.${key}`, false, true);
  const mark = React.useCallback(() => setSeen(true), [setSeen]);
  return [seen, mark];
}
