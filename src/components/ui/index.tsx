"use client";

import * as React from "react";

import { cx } from "@/lib/cx";

export { cx } from "@/lib/cx";

/* ------------------------------------------------------------------ Panel */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  exportName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Enables a PNG export of this panel's drawing, using this as the file name.
   * Set it on panels whose content is a figure someone might want to keep.
   */
  exportName?: string;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);

  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-surface-1/80 backdrop-blur-[2px]",
        className,
      )}
    >
      {/* Header stacks on phones: side by side, a long title and a legend each
          get a sliver of the width and both become unreadable. */}
      {(title || action || exportName) && (
        <header className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <div className="flex items-start gap-2 sm:shrink-0">
            {action}
            {exportName && <ExportPngButton name={exportName} target={bodyRef} />}
          </div>
        </header>
      )}
      <div ref={bodyRef} className={cx("p-4", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Save the first drawing inside `target` as a PNG.
 *
 * It looks for an `<svg>` first and falls back to a `<canvas>`, which covers
 * every visualisation on the site — the plots are SVG with the decision surface
 * embedded as an image, and the weight-image grids are canvas.
 */
function ExportPngButton({
  name,
  target,
}: {
  name: string;
  target: React.RefObject<HTMLDivElement | null>;
}) {
  const [state, setState] = React.useState<"idle" | "done" | "error">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);

  const onClick = async () => {
    const host = target.current;
    if (!host) return;
    try {
      const { exportCanvasToPng, exportSvgToPng } = await import("@/lib/viz/export-png");
      const svg = host.querySelector("svg");
      if (svg) {
        await exportSvgToPng(svg as SVGSVGElement, { name });
      } else {
        const canvas = host.querySelector("canvas");
        if (!canvas) {
          setState("error");
          return;
        }
        await exportCanvasToPng(canvas as HTMLCanvasElement, { name });
      }
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <button
      onClick={onClick}
      title="Enregistrer cette figure en PNG"
      aria-label="Enregistrer cette figure en PNG"
      className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      {state === "done" ? "✓ PNG" : state === "error" ? "échec" : "PNG"}
    </button>
  );
}

/* ----------------------------------------------------------------- Slider */

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
}: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <label className={cx("block", disabled && "opacity-50")}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="tnum text-xs font-semibold text-ink">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${pct}%` } as React.CSSProperties}
        className="mt-1.5"
      />
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-muted">{hint}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------- Select */

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: React.ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 w-full appearance-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors hover:border-line-strong focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-muted">{hint}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------- Button */

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  className,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const variants = {
    default: "border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
    primary: "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25",
    ghost: "border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
    danger: "border-critical/40 bg-critical/10 text-critical hover:bg-critical/20",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------- SegmentedControl */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label?: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <div>
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>}
      <div
        role="tablist"
        className="inline-flex w-full rounded-lg border border-line bg-surface-2 p-0.5"
      >
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            aria-selected={value === o.value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex-1 rounded-[6px] font-medium transition-colors",
              size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
              value === o.value
                ? "bg-surface-3 text-ink shadow-sm"
                : "text-ink-muted hover:text-ink-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Toggle */

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent/60 bg-accent/30" : "border-line bg-surface-3",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-3 w-3 rounded-full transition-all",
            checked ? "left-[16px] bg-accent" : "left-[2px] bg-ink-muted",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink-2">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  unit,
  tone = "neutral",
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  tone?: "neutral" | "good" | "critical" | "warning";
  hint?: React.ReactNode;
}) {
  const tones = {
    neutral: "text-ink",
    good: "text-good",
    critical: "text-critical",
    warning: "text-warning",
  };
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] font-medium text-ink-muted">{label}</div>
      <div className={cx("tnum mt-0.5 text-lg font-semibold leading-none", tones[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-ink-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Callout */

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: "note" | "warning" | "insight" | "critical";
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    note: "border-line bg-surface-2/50",
    warning: "border-warning/30 bg-warning/[0.06]",
    insight: "border-accent/30 bg-accent/[0.06]",
    critical: "border-critical/35 bg-critical/[0.06]",
  };
  // Status colours never carry meaning alone: each kind ships an icon too.
  const icons = { note: "◈", warning: "▲", insight: "✦", critical: "■" };
  const iconColors = {
    note: "text-ink-muted",
    warning: "text-warning",
    insight: "text-accent",
    critical: "text-critical",
  };
  return (
    <div className={cx("rounded-lg border px-3.5 py-3", styles[kind])}>
      <div className="flex gap-2.5">
        <span className={cx("mt-px shrink-0 text-xs", iconColors[kind])} aria-hidden>
          {icons[kind]}
        </span>
        <div className="min-w-0 text-[13px] leading-relaxed text-ink-2">
          {title && <div className="mb-0.5 font-semibold text-ink">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Field */

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3.5">{children}</div>;
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-line" />;
  return (
    <div className="my-4 flex items-center gap-2.5">
      <hr className="flex-1 border-line" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <hr className="flex-1 border-line" />
    </div>
  );
}
