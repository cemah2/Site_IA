"use client";

import * as React from "react";
import { cx } from "@/lib/cx";
import { DIGIT_SIZE } from "@/lib/ml/digits";
import { CHROME } from "@/lib/viz/palette";

/**
 * A pad for drawing a digit with a mouse or a finger.
 *
 * The drawing is kept at a higher resolution than the network's 16×16 input and
 * downsampled on read. Drawing directly into 16×16 cells produces a staircase
 * that looks nothing like handwriting — and the network, quite correctly, would
 * then fail to recognise it, making the model look worse than it is.
 */
export function DigitCanvas({
  onChange,
  size = 280,
  className,
  brush = 1.6,
}: {
  /** Called with the 16×16 greyscale values, each in [0, 1]. */
  onChange: (pixels: Float32Array) => void;
  size?: number;
  className?: string;
  /** Stroke width, in grid cells. */
  brush?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = React.useState(true);

  // The internal drawing surface: 8× the model's grid, so strokes are smooth.
  const RES = DIGIT_SIZE * 8;

  const ctxOf = () => canvasRef.current?.getContext("2d") ?? null;

  const clear = React.useCallback(() => {
    const ctx = ctxOf();
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, RES, RES);
    setEmpty(true);
    onChange(new Float32Array(DIGIT_SIZE * DIGIT_SIZE));
  }, [onChange, RES]);

  React.useEffect(() => {
    const ctx = ctxOf();
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, RES, RES);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
  }, [RES]);

  const read = React.useCallback(() => {
    const ctx = ctxOf();
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, RES, RES).data;
    const out = new Float32Array(DIGIT_SIZE * DIGIT_SIZE);
    const step = RES / DIGIT_SIZE;
    for (let gy = 0; gy < DIGIT_SIZE; gy++) {
      for (let gx = 0; gx < DIGIT_SIZE; gx++) {
        let sum = 0;
        for (let y = 0; y < step; y++) {
          for (let x = 0; x < step; x++) {
            const px = ((gy * step + y) * RES + gx * step + x) * 4;
            sum += img[px];
          }
        }
        out[gy * DIGIT_SIZE + gx] = sum / (step * step * 255);
      }
    }
    onChange(out);
  }, [onChange, RES]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * RES,
      y: ((e.clientY - rect.top) / rect.height) * RES,
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = ctxOf();
    if (!ctx) return;
    ctx.lineWidth = brush * (RES / DIGIT_SIZE);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={RES}
        height={RES}
        style={{ width: size, height: size, touchAction: "none", imageRendering: "auto" }}
        className="block cursor-crosshair rounded-xl border border-line-strong bg-black"
        aria-label="Zone de dessin : tracez un chiffre de 0 à 9"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const p = toLocal(e);
          last.current = p;
          // A single tap should leave a dot, not nothing.
          stroke(p, { x: p.x + 0.01, y: p.y });
          setEmpty(false);
          read();
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = toLocal(e);
          stroke(last.current, p);
          last.current = p;
          read();
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          read();
        }}
        onPointerLeave={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-muted">
          {empty ? "Tracez un chiffre de 0 à 9" : "Le réseau répond en direct"}
        </span>
        <button
          onClick={clear}
          className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          Effacer
        </button>
      </div>
    </div>
  );
}

/** A 16×16 greyscale grid — what the network actually receives. */
export function DigitGrid({
  pixels,
  size = 160,
  className,
  showGrid = true,
}: {
  pixels: Float32Array | null;
  size?: number;
  className?: string;
  showGrid?: boolean;
}) {
  const cell = size / DIGIT_SIZE;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cx("block rounded-lg border border-line", className)}
      role="img"
      aria-label="Image 16 × 16 transmise au réseau"
    >
      <rect width={size} height={size} fill="#000000" />
      {pixels &&
        Array.from({ length: DIGIT_SIZE * DIGIT_SIZE }, (_, i) => {
          const v = pixels[i];
          if (v <= 0.01) return null;
          return (
            <rect
              key={i}
              x={(i % DIGIT_SIZE) * cell}
              y={Math.floor(i / DIGIT_SIZE) * cell}
              width={cell}
              height={cell}
              fill={`rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`}
            />
          );
        })}
      {showGrid &&
        Array.from({ length: DIGIT_SIZE - 1 }, (_, i) => (
          <g key={i} opacity={0.18}>
            <line
              x1={(i + 1) * cell}
              y1={0}
              x2={(i + 1) * cell}
              y2={size}
              stroke={CHROME.lineStrong}
              strokeWidth={0.5}
            />
            <line
              x1={0}
              y1={(i + 1) * cell}
              x2={size}
              y2={(i + 1) * cell}
              stroke={CHROME.lineStrong}
              strokeWidth={0.5}
            />
          </g>
        ))}
    </svg>
  );
}
