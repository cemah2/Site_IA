"use client";


import { Line, OrbitControls } from "@react-three/drei";
import * as React from "react";
import * as THREE from "three";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { rampAt, SEQUENTIAL, CHROME, STATUS } from "@/lib/viz/palette";
import { Viz3DCanvas } from "./Viz3D";

export interface SurfacePoint {
  a: number;
  b: number;
  cost: number;
}

/**
 * The cost surface J(θ), with the optimiser's trajectory on it.
 *
 * Heights are compressed with `log1p` before display. A quadratic bowl spans
 * several orders of magnitude between its rim and its floor; drawn linearly,
 * the interesting part — the last stretch into the minimum, where learning-rate
 * behaviour actually differs — is a flat plate one pixel thick. The vertical
 * axis is therefore explicitly labelled as non-linear rather than quietly
 * distorted.
 */
export function CostSurface3D({
  costAt,
  aRange,
  bRange,
  trajectory,
  current,
  gradient,
  height = 400,
  resolution = 44,
}: {
  costAt: (a: number, b: number) => number;
  aRange: [number, number];
  bRange: [number, number];
  trajectory: SurfacePoint[];
  current: SurfacePoint | null;
  /** Gradient at the current point, drawn as the arrow the step follows. */
  gradient?: { da: number; db: number } | null;
  height?: number;
  resolution?: number;
}) {
  const { geometry, zScale, maxCost } = React.useMemo(() => {
    const res = resolution;
    const positions = new Float32Array(res * res * 3);
    const colors = new Float32Array(res * res * 3);
    const indices: number[] = [];

    let maxC = 0;
    const costs = new Float64Array(res * res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const a = aRange[0] + ((aRange[1] - aRange[0]) * i) / (res - 1);
        const b = bRange[0] + ((bRange[1] - bRange[0]) * j) / (res - 1);
        const c = costAt(a, b);
        costs[j * res + i] = c;
        if (Number.isFinite(c)) maxC = Math.max(maxC, c);
      }
    }

    const zs = 3.2 / Math.log1p(maxC || 1);
    const colour = new THREE.Color();

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const k = j * res + i;
        const c = costs[k];
        positions[k * 3] = -3 + (6 * i) / (res - 1);
        positions[k * 3 + 1] = Math.log1p(Math.max(0, c)) * zs;
        positions[k * 3 + 2] = -3 + (6 * j) / (res - 1);
        // Sequential ramp, light at the minimum: the surface is a magnitude,
        // so it gets the one-hue ramp, never a rainbow.
        colour.set(rampAt(SEQUENTIAL, 1 - Math.log1p(c) / Math.log1p(maxC || 1)));
        colors[k * 3] = colour.r;
        colors[k * 3 + 1] = colour.g;
        colors[k * 3 + 2] = colour.b;
      }
    }

    for (let j = 0; j < res - 1; j++) {
      for (let i = 0; i < res - 1; i++) {
        const a = j * res + i;
        indices.push(a, a + res, a + 1, a + 1, a + res, a + res + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return { geometry: geo, zScale: zs, maxCost: maxC };
  }, [costAt, aRange, bRange, resolution]);

  const toScene = React.useCallback(
    (p: SurfacePoint): [number, number, number] => [
      -3 + (6 * (p.a - aRange[0])) / (aRange[1] - aRange[0]),
      Math.log1p(Math.max(0, p.cost)) * zScale + 0.06,
      -3 + (6 * (p.b - bRange[0])) / (bRange[1] - bRange[0]),
    ],
    [aRange, bRange, zScale],
  );

  const pathPoints = React.useMemo(
    () => trajectory.filter((p) => Number.isFinite(p.cost)).map(toScene),
    [trajectory, toScene],
  );

  const ballPos = current && Number.isFinite(current.cost) ? toScene(current) : null;

  const arrow = React.useMemo(() => {
    if (!ballPos || !gradient || !current) return null;
    // The step direction is the NEGATIVE gradient; that sign is the whole idea,
    // so the arrow points where the ball will actually go.
    const norm = Math.hypot(gradient.da, gradient.db) || 1;
    const len = Math.min(1.5, 0.35 + Math.log1p(norm) * 0.4);
    const dx = (-gradient.da / norm) * len * (6 / (aRange[1] - aRange[0])) * 0.9;
    const dz = (-gradient.db / norm) * len * (6 / (bRange[1] - bRange[0])) * 0.9;
    return [ballPos, [ballPos[0] + dx, ballPos[1], ballPos[2] + dz]] as [number, number, number][];
  }, [ballPos, gradient, current, aRange, bRange]);

  return (
    <div
      className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-lg border border-line bg-plane"
      style={{ height }}
    >
      <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-surface-2/40" />}>
        <Viz3DCanvas camera={{ position: [5.4, 4.6, 5.4], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[6, 9, 4]} intensity={0.85} />

          <mesh geometry={geometry}>
            <meshStandardMaterial
              vertexColors
              side={THREE.DoubleSide}
              roughness={0.72}
              metalness={0.02}
              transparent
              opacity={0.93}
            />
          </mesh>
          <mesh geometry={geometry}>
            <meshBasicMaterial wireframe color={CHROME.line} transparent opacity={0.16} />
          </mesh>

          {pathPoints.length > 1 && (
            <Line points={pathPoints} color={STATUS.warning} lineWidth={2.5} />
          )}

          {ballPos && (
            <mesh position={ballPos}>
              <sphereGeometry args={[0.13, 20, 20]} />
              <meshStandardMaterial color={CHROME.ink} roughness={0.3} />
            </mesh>
          )}

          {arrow && <Line points={arrow} color={STATUS.warning} lineWidth={3} />}

          <OrbitControls
            enablePan={false}
            minDistance={4}
            maxDistance={18}
            maxPolarAngle={Math.PI / 2.02}
          />
        </Viz3DCanvas>
      </ClientOnly>

      <div className="pointer-events-none absolute bottom-2.5 left-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink-muted">
        <span>plan horizontal : pente a, ordonnée b</span>
        <span>hauteur : J(a, b), échelle log</span>
        <span className="tnum">max ≈ {maxCost.toFixed(1)}</span>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-line bg-surface-1/85 px-2 py-1 text-[10px] text-ink-muted backdrop-blur-sm">
        Faites tourner · molette pour zoomer
      </div>
    </div>
  );
}
