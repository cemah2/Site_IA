"use client";

import { useFrame } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { classColor } from "@/lib/viz/palette";

export interface Point3D {
  x: number;
  y: number;
  z: number;
  c: number;
}

/**
 * Many 3-D points as a single instanced draw call.
 *
 * Written after an isolation test: on the SVM page, removing the 3-D canvas
 * took a drag from 20 fps with 92 blocking tasks to 60 fps with none. Giving
 * every sample its own `<mesh>` meant React reconciled 160 three.js objects per
 * pointer move, and rebuilding the colour attribute re-uploaded a GPU buffer
 * just as often.
 *
 * Two separations fix it, and both matter:
 *  - **Matrices are written in `useFrame`**, straight into the instance buffer,
 *    so moving points never touches the React tree.
 *  - **Colours are written only when class assignments change**, keyed on a
 *    signature of the labels rather than on the points array's identity —
 *    dragging changes positions, not classes, and the palette upload should not
 *    ride along with it.
 */
export function InstancedPoints({
  points,
  radius = 0.085,
  positionOf,
  highlight,
}: {
  points: Point3D[];
  radius?: number;
  /** Maps a point to scene coordinates; called per point per frame. */
  positionOf: (p: Point3D, index: number) => [number, number, number];
  /** Index of a point to enlarge, or null. */
  highlight?: number | null;
}) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  const colorScratch = React.useMemo(() => new THREE.Color(), []);

  // Identity of `points` changes on every drag frame, but the classes rarely
  // do; this signature is what keeps the colour upload off the hot path.
  const classSignature = React.useMemo(() => points.map((p) => p.c).join(","), [points]);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < points.length; i++) {
      colorScratch.set(classColor(points[i].c));
      mesh.setColorAt(i, colorScratch);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // `points` is intentionally absent: only the class signature should
    // trigger a colour rewrite.
  }, [classSignature, colorScratch]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = positionOf(points[i], i);
      dummy.position.set(x, y, z);
      const s = highlight === i ? 1.5 : 1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      // Remounting only when the count changes keeps the buffers stable.
      key={points.length}
      args={[undefined, undefined, Math.max(1, points.length)]}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      <meshStandardMaterial roughness={0.45} metalness={0.05} />
    </instancedMesh>
  );
}
