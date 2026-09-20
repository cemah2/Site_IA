/**
 * Light and dark, for the parts of the site that are drawn rather than styled.
 *
 * Tailwind classes follow CSS custom properties and switch by themselves. SVG
 * could do the same with `var(--…)`, but canvas cannot — `ctx.strokeStyle`
 * does not resolve custom properties — and several visualisations here are
 * canvas. So the drawing colours live in JavaScript, and the two sets are
 * swapped at the source.
 *
 * Why a light mode exists at all: this site gets projected in rooms with the
 * lights on, where a dark theme washes out to grey on grey. The series palette
 * needed no change — it was re-validated against a white plot surface and
 * passes every check — which is the only reason this was affordable.
 */

export type ThemeName = "dark" | "light";

export interface ChromeColours {
  plane: string;
  surface1: string;
  surface2: string;
  surface3: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  inkMuted: string;
  grid: string;
  axis: string;
  accent: string;
}

export interface StatusColours {
  good: string;
  warning: string;
  serious: string;
  critical: string;
}

export const CHROME_DARK: ChromeColours = {
  plane: "#080b12",
  surface1: "#10141b",
  surface2: "#161c25",
  surface3: "#1e2631",
  line: "#232b37",
  lineStrong: "#33404f",
  ink: "#eef2f8",
  ink2: "#9fabbd",
  inkMuted: "#6b7686",
  grid: "#1a212b",
  axis: "#2e3947",
  accent: "#7aa2ff",
};

/**
 * The plot surface is pure white on purpose: on the slightly grey panel colour
 * the series green measures 2.82:1, just under the 3:1 floor. White puts every
 * series back above it.
 */
export const CHROME_LIGHT: ChromeColours = {
  plane: "#f6f8fb",
  surface1: "#ffffff",
  surface2: "#eef2f7",
  surface3: "#e2e9f1",
  line: "#dbe3ec",
  lineStrong: "#aebbcb",
  ink: "#10151d",
  ink2: "#47536a",
  inkMuted: "#5b6779",
  grid: "#eef2f7",
  axis: "#b9c4d2",
  accent: "#1d4ed8",
};

export const STATUS_DARK: StatusColours = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

/** Darkened so each one still reads as text: the dark-mode amber measures
 *  1.8:1 on white, which is unreadable rather than merely low. */
export const STATUS_LIGHT: StatusColours = {
  good: "#0a7d0a",
  warning: "#9a6a00",
  serious: "#b8532a",
  critical: "#b32020",
};

/** Diverging ramp: only the neutral midpoint differs, and it has to. */
export const DIVERGING_DARK = [
  "#256abf",
  "#3987e5",
  "#86b6ef",
  "#383835",
  "#e89a9a",
  "#d03b3b",
  "#9d2020",
] as const;

export const DIVERGING_LIGHT = [
  "#1d4ed8",
  "#3987e5",
  "#86b6ef",
  "#ececeb",
  "#e89a9a",
  "#d03b3b",
  "#8e1c1c",
] as const;

const STORAGE_KEY = "mllab.theme";
const listeners = new Set<() => void>();

/**
 * Initialised from the document, not from an effect.
 *
 * The inline bootstrap in the head has already written `data-theme` before any
 * module runs, so reading it here means the drawing colours are correct from
 * the very first render — no flash, and no state written during rendering.
 * On the server there is no document and the default stands; every
 * visualisation on this site is client-only anyway.
 */
let current: ThemeName = "dark";
if (typeof document !== "undefined" && document.documentElement.dataset.theme === "light") {
  current = "light";
}

export function getTheme(): ThemeName {
  return current;
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function chrome(): ChromeColours {
  return current === "light" ? CHROME_LIGHT : CHROME_DARK;
}

export function status(): StatusColours {
  return current === "light" ? STATUS_LIGHT : STATUS_DARK;
}

export function diverging(): readonly string[] {
  return current === "light" ? DIVERGING_LIGHT : DIVERGING_DARK;
}

/** The reader's stored choice, or the operating system's preference. */
export function preferredTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(next: ThemeName, remember = true): void {
  current = next;
  try {
    document.documentElement.dataset.theme = next;
    if (remember) window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage or DOM unavailable — the in-memory theme still applies */
  }
  for (const fn of listeners) fn();
}

/**
 * Runs before first paint, from the document head.
 *
 * Inlined as a string because it must execute before React hydrates: reading
 * the preference in an effect would paint the dark theme first and flash.
 */
export const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='dark';}})()`;
