import {
  CHROME_DARK,
  CHROME_LIGHT,
  DIVERGING_DARK,
  DIVERGING_LIGHT,
  STATUS_DARK,
  STATUS_LIGHT,
  getTheme,
  type ChromeColours,
  type StatusColours,
  type ThemeName,
} from "./theme";

/**
 * The chart palette, mirrored from the CSS custom properties in globals.css so
 * that canvas/WebGL code (which cannot read Tailwind classes) draws the same
 * colours as the DOM.
 *
 * Validation of the categorical slots is documented in globals.css and in
 * docs/design-system.md. Two rules hold everywhere in this codebase:
 *   1. Slots are assigned in fixed order and NEVER cycled. Past five classes we
 *      refuse rather than invent a sixth hue (see `MAX_COLOURED_CLASSES`).
 *   2. Class identity always carries a shape as well as a colour, so it is
 *      never colour-alone.
 */

export const SERIES = ["#2584f5", "#e45a20", "#27a37e", "#9637ab", "#bb1f54"] as const;

export const MAX_COLOURED_CLASSES = SERIES.length;

export type ClassShape = "circle" | "square" | "triangle" | "diamond" | "cross";

export const SHAPES: ClassShape[] = ["circle", "square", "triangle", "diamond", "cross"];

export function classColor(i: number): string {
  return SERIES[i] ?? "#6b7686";
}

export function classShape(i: number): ClassShape {
  return SHAPES[i] ?? "circle";
}

/**
 * Drawing colours for the active theme.
 *
 * Mutated in place when the theme changes rather than replaced, because a
 * hundred call sites read `CHROME.ink` during render and an exported binding
 * cannot be reassigned across modules. The shell remounts its subtree on a
 * theme switch, so every memo and every canvas redraws with the new values —
 * which is what makes mutation safe here rather than merely convenient.
 */
const initial: ThemeName = getTheme();

export const CHROME: ChromeColours = {
  ...(initial === "light" ? CHROME_LIGHT : CHROME_DARK),
};

export const STATUS: StatusColours = {
  ...(initial === "light" ? STATUS_LIGHT : STATUS_DARK),
};

/** Diverging ramp for signed quantities (residuals, gradients): blue <-> red
 *  around a neutral midpoint. Never a hue at the midpoint. */
export const DIVERGING: string[] = [
  ...(initial === "light" ? DIVERGING_LIGHT : DIVERGING_DARK),
];

/** Swap every drawing colour to the given theme. Called by the theme toggle. */
export function applyPaletteTheme(name: ThemeName): void {
  Object.assign(CHROME, name === "light" ? CHROME_LIGHT : CHROME_DARK);
  Object.assign(STATUS, name === "light" ? STATUS_LIGHT : STATUS_DARK);
  DIVERGING.length = 0;
  DIVERGING.push(...(name === "light" ? DIVERGING_LIGHT : DIVERGING_DARK));
}

/** Single-hue sequential ramp, light -> dark, for continuous magnitude. */
export const SEQUENTIAL = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
] as const;

/** Sample a ramp at t in [0,1] with linear interpolation between steps. */
export function rampAt(ramp: readonly string[], t: number): string {
  const u = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.floor(u);
  if (i >= ramp.length - 1) return ramp[ramp.length - 1];
  return mix(ramp[i], ramp[i + 1], u - i);
}

/**
 * A colour as three channel values, whatever notation it arrived in.
 *
 * `rampAt` returns a hex string when the sample lands exactly on a ramp stop
 * and an `rgb(...)` string when it interpolates between two. Anything reading
 * channels back out of a ramp has to accept both — parsing digits out of
 * `#256abf` with a number regex yields 256, then NaN, then NaN, which is how
 * stray green pixels appeared in the neural-network weight images.
 */
export function toRgbTriple(colour: string): [number, number, number] {
  if (colour.startsWith("#")) return hexToRgb(colour);
  const parts = colour.match(/-?\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) return [0, 0, 0];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
