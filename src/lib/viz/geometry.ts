import type { ClassShape } from "./palette";

export interface Scale {
  /** data -> pixels */
  (v: number): number;
  invert: (px: number) => number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const fn = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Scale;
  fn.invert = (px: number) => d0 + ((px - r0) / (r1 - r0 || 1)) * span;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/**
 * "Nice" tick values for an axis — round numbers at a human step size.
 * Ticks that read 0.8333 are noise; ticks that read 1, 2, 3 are information.
 */
export function ticks(domain: [number, number], count = 6): number[] {
  const [lo, hi] = domain;
  const raw = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

/**
 * SVG path for a class marker.
 *
 * Shape is the site's mandatory secondary encoding for class identity: colour
 * alone would fail for colour-blind readers on the tighter pairs, and shape
 * also survives printing and forced-colours mode. All five shapes are sized to
 * roughly equal visual area so no class looks "bigger" than another.
 */
export function shapePath(shape: ClassShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case "square": {
      const s = r * 0.9;
      return `M${cx - s},${cy - s}H${cx + s}V${cy + s}H${cx - s}Z`;
    }
    case "triangle": {
      const s = r * 1.25;
      return `M${cx},${cy - s}L${cx + s * 0.866},${cy + s * 0.5}L${cx - s * 0.866},${cy + s * 0.5}Z`;
    }
    case "diamond": {
      const s = r * 1.25;
      return `M${cx},${cy - s}L${cx + s},${cy}L${cx},${cy + s}L${cx - s},${cy}Z`;
    }
    case "cross": {
      const a = r * 1.3;
      const b = r * 0.42;
      return (
        `M${cx - b},${cy - a}H${cx + b}V${cy - b}H${cx + a}V${cy + b}H${cx + b}` +
        `V${cy + a}H${cx - b}V${cy + b}H${cx - a}V${cy - b}H${cx - b}Z`
      );
    }
    default: {
      return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
    }
  }
}

/** Same shapes, drawn onto a 2-D canvas context. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: ClassShape,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  switch (shape) {
    case "square":
      ctx.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
      break;
    case "triangle": {
      const s = r * 1.25;
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.866, cy + s * 0.5);
      ctx.lineTo(cx - s * 0.866, cy + s * 0.5);
      ctx.closePath();
      break;
    }
    case "diamond": {
      const s = r * 1.25;
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      break;
    }
    case "cross": {
      const a = r * 1.3;
      const b = r * 0.42;
      ctx.moveTo(cx - b, cy - a);
      ctx.lineTo(cx + b, cy - a);
      ctx.lineTo(cx + b, cy - b);
      ctx.lineTo(cx + a, cy - b);
      ctx.lineTo(cx + a, cy + b);
      ctx.lineTo(cx + b, cy + b);
      ctx.lineTo(cx + b, cy + a);
      ctx.lineTo(cx - b, cy + a);
      ctx.lineTo(cx - b, cy + b);
      ctx.lineTo(cx - a, cy + b);
      ctx.lineTo(cx - a, cy - b);
      ctx.lineTo(cx - b, cy - b);
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

export function formatNumber(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  if (v !== 0 && Math.abs(v) < 0.001) return v.toExponential(1);
  return v.toFixed(digits);
}

export function formatPercent(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)} %`;
}
