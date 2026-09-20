"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as React from "react";
import * as THREE from "three";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { classColor, CHROME } from "@/lib/viz/palette";

export interface Point3 {
  id: number;
  x: number;
  y: number;
  z: number;
  c: number;
}

/**
 * A rotatable 3-D scatter with an optional separating plane.
 *
 * The third axis is what makes several concepts visible at all: a hyperplane
 * is a plane rather than a line, a projection is a real shadow, and "this
 * problem is only separable once you add a feature" stops being a claim.
 *
 * Selection is done by raycast against the spheres rather than by screen-space
 * distance, so the point you pick is the one in front — which is the only
 * behaviour that feels correct once the cloud is rotated.
 */
export function Scatter3D({
  points,
  domain = [-3.2, 3.2],
  plane,
  showProjection = false,
  selected,
  onSelect,
  height = 420,
  axisLabels = ["x₁", "x₂", "x₃"],
}: {
  points: Point3[];
  domain?: [number, number];
  /** Plane z = a·x + b·y + c, drawn as a translucent quad. */
  plane?: { a: number; b: number; c: number } | null;
  showProjection?: boolean;
  selected?: number | null;
  onSelect?: (id: number | null) => void;
  height?: number;
  axisLabels?: [string, string, string];
}) {
  const scale = 3 / Math.max(Math.abs(domain[0]), Math.abs(domain[1]));

  return (
    <div
      className="relative mx-auto w-full max-w-[660px] overflow-hidden rounded-lg border border-line bg-plane"
      style={{ height }}
    >
      <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-surface-2/40" />}>
        <Canvas camera={{ position: [5.6, 4.2, 5.6], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={1.35} />
          <directionalLight position={[5, 8, 5]} intensity={0.7} />
          <Axes labels={axisLabels} />

          {points.map((p) => {
            const pos: [number, number, number] = [p.x * scale, p.z * scale, -p.y * scale];
            const isSel = selected === p.id;
            return (
              <group key={p.id}>
                <mesh
                  position={pos}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(isSel ? null : p.id);
                  }}
                >
                  <sphereGeometry args={[isSel ? 0.12 : 0.085, 14, 14]} />
                  <meshStandardMaterial
                    color={classColor(p.c)}
                    roughness={0.45}
                    emissive={isSel ? classColor(p.c) : "#000000"}
                    emissiveIntensity={isSel ? 0.5 : 0}
                  />
                </mesh>
                {/* The projection: a dropped shadow plus the segment to it,
                    which is what "projecting onto the x₁x₂ plane" means. */}
                {showProjection && (
                  <>
                    <Line
                      points={[pos, [pos[0], -3, pos[2]]]}
                      color={CHROME.lineStrong}
                      lineWidth={1}
                      transparent
                      opacity={0.45}
                    />
                    <mesh position={[pos[0], -3, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                      <circleGeometry args={[0.07, 12]} />
                      <meshBasicMaterial color={classColor(p.c)} transparent opacity={0.55} />
                    </mesh>
                  </>
                )}
              </group>
            );
          })}

          {plane && <SeparatingPlane plane={plane} scale={scale} />}

          <OrbitControls
            enablePan={false}
            minDistance={4}
            maxDistance={18}
            maxPolarAngle={Math.PI / 1.7}
          />
        </Canvas>
      </ClientOnly>

      <div className="pointer-events-none absolute bottom-2.5 left-3 flex gap-3 text-[10px] text-ink-muted">
        <span>horizontal : {axisLabels[0]}, {axisLabels[1]}</span>
        <span>vertical : {axisLabels[2]}</span>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-line bg-surface-1/85 px-2 py-1 text-[10px] text-ink-muted backdrop-blur-sm">
        Faites tourner · molette pour zoomer{onSelect ? " · cliquez un point" : ""}
      </div>
    </div>
  );
}

function SeparatingPlane({
  plane,
  scale,
}: {
  plane: { a: number; b: number; c: number };
  scale: number;
}) {
  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const lim = 3.2;
    const at = (sx: number, sy: number): [number, number, number] => {
      const x = sx / scale;
      const y = sy / scale;
      const z = plane.a * x + plane.b * y + plane.c;
      return [sx, Math.max(-3.4, Math.min(3.4, z * scale)), -sy];
    };
    const corners = [at(-lim, -lim), at(lim, -lim), at(lim, lim), at(-lim, lim)];
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(corners.flat(), 3),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, [plane, scale]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={CHROME.accent}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Axes({ labels }: { labels: [string, string, string] }) {
  const { camera } = useThree();
  void camera;
  void labels;
  const grid = React.useMemo(() => {
    const out: [number, number, number][][] = [];
    for (let i = -3; i <= 3; i++) {
      out.push([
        [i, -3, -3],
        [i, -3, 3],
      ]);
      out.push([
        [-3, -3, i],
        [3, -3, i],
      ]);
    }
    return out;
  }, []);

  return (
    <group>
      {grid.map((pts, i) => (
        <Line key={i} points={pts} color={CHROME.grid} lineWidth={1} />
      ))}
      <Line points={[[-3.3, -3, -3], [3.3, -3, -3]]} color={CHROME.axis} lineWidth={1.5} />
      <Line points={[[-3, -3, -3.3], [-3, -3, 3.3]]} color={CHROME.axis} lineWidth={1.5} />
      <Line points={[[-3, -3.3, -3], [-3, 3.3, -3]]} color={CHROME.axis} lineWidth={1.5} />
    </group>
  );
}
