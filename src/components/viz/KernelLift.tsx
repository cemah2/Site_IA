"use client";

import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as React from "react";
import * as THREE from "three";
import { Button, Slider, cx } from "@/components/ui";
import { ClientOnly } from "@/components/ui/ClientOnly";
import type { Dataset } from "@/lib/ml/types";
import type { KernelKind } from "@/lib/ml/models/svm";
import { classColor, CHROME } from "@/lib/viz/palette";
import { Tex } from "@/components/math/Math";

/**
 * The kernel trick, shown as an actual lift into a third dimension.
 *
 * For the polynomial kernel of degree 2 the feature map is explicit and finite,
 * so the third axis here is a *real* coordinate of the space the SVM works in,
 * not an illustration:
 *
 *     φ(x₁, x₂) = (x₁, x₂, x₁² + x₂²)
 *
 * The RBF kernel's feature space is infinite-dimensional and cannot be drawn at
 * all — so the page says so, and shows this same finite surface as a stand-in
 * for the *idea*. Presenting it as the real RBF space would be a lie the
 * learner would carry away.
 */
export function KernelLift({
  dataset,
  kernel,
  gamma,
}: {
  dataset: Dataset;
  kernel: KernelKind;
  gamma: number;
  degree: number;
}) {
  const [lift, setLift] = React.useState(0);
  const [planeZ, setPlaneZ] = React.useState(2.2);
  const [playing, setPlaying] = React.useState(false);

  // Animate the lift with rAF rather than a CSS transition: the value drives
  // three.js geometry, which is outside React's rendering.
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setLift((v) => {
        const next = v + 0.014;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const points = React.useMemo(
    () =>
      dataset.samples.map((s) => ({
        id: s.id,
        x: s.x[0],
        y: s.x[1],
        z: s.x[0] ** 2 + s.x[1] ** 2,
        c: s.y,
      })),
    [dataset.samples],
  );

  const maxZ = React.useMemo(() => Math.max(1, ...points.map((p) => p.z)), [points]);
  // Compress the lifted axis so the cloud stays inside the viewport.
  const zScale = 4 / maxZ;

  return (
    <div className="space-y-3">
      <div className="relative mx-auto h-[400px] w-full max-w-[640px] overflow-hidden rounded-lg border border-line bg-plane">
        <ClientOnly
          fallback={<div className="h-full w-full animate-pulse bg-surface-2/40" />}
        >
          <Canvas camera={{ position: [5.1, 3.4, 5.1], fov: 42 }} dpr={[1, 2]}>
            <ambientLight intensity={1.4} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} />

            <GroundGrid />

            {points.map((p) => (
              <mesh
                key={p.id}
                position={[p.x, p.z * zScale * lift, -p.y]}
              >
                <sphereGeometry args={[0.085, 14, 14]} />
                <meshStandardMaterial
                  color={classColor(p.c)}
                  roughness={0.45}
                  metalness={0.05}
                />
              </mesh>
            ))}

            {/* The separating plane: meaningless at lift = 0 (nothing to
                separate), so it fades in with the lift. */}
            {lift > 0.05 && (
              <mesh position={[0, planeZ * lift, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[7.2, 7.2]} />
                <meshBasicMaterial
                  color={CHROME.accent}
                  transparent
                  opacity={0.16 * lift}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}

            <OrbitControls
              enablePan={false}
              minDistance={3.5}
              maxDistance={16}
              maxPolarAngle={Math.PI / 2.05}
            />
          </Canvas>
        </ClientOnly>

        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-surface-1/85 px-2.5 py-1.5 text-[11px] text-ink-2 backdrop-blur-sm">
          {lift < 0.05 ? (
            <>Espace d&apos;origine — aucune droite ne sépare ces classes.</>
          ) : lift < 0.95 ? (
            <>Transformation en cours…</>
          ) : (
            <>
              Espace transformé — un <strong className="text-ink">plan</strong> suffit.
            </>
          )}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-line bg-surface-1/85 px-2.5 py-1.5 text-[10px] text-ink-muted backdrop-blur-sm">
          Faites tourner · molette pour zoomer
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 text-[10px] text-ink-muted">
          <span>plan horizontal : x₁, x₂</span>
          <span>axe vertical : z = x₁² + x₂²</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
        <Button
          variant="primary"
          onClick={() => {
            if (lift >= 1) {
              setLift(0);
              setPlaying(true);
            } else {
              setPlaying((p) => !p);
            }
          }}
        >
          {playing ? "Pause" : lift >= 1 ? "Rejouer" : "Transformer →"}
        </Button>
        <Slider
          label="Élévation"
          value={lift}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => {
            setPlaying(false);
            setLift(v);
          }}
          format={(v) => `${Math.round(v * 100)} %`}
        />
        <Slider
          label="Hauteur du plan séparateur"
          value={planeZ}
          min={0}
          max={4}
          step={0.05}
          onChange={setPlaneZ}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div
        className={cx(
          "rounded-lg border px-3.5 py-2.5 text-[12px] leading-relaxed",
          kernel === "rbf"
            ? "border-warning/30 bg-warning/[0.06] text-ink-2"
            : "border-line bg-surface-2/50 text-ink-2",
        )}
      >
        {kernel === "poly" ? (
          <>
            La troisième dimension affichée est{" "}
            <Tex>{String.raw`z = x_1^2 + x_2^2`}</Tex> — une coordonnée réelle de l&apos;espace
            dans lequel travaille le noyau polynomial de degré 2. Ce que vous voyez est
            littéralement ce que fait le modèle.
          </>
        ) : kernel === "rbf" ? (
          <>
            <strong className="text-ink">Attention :</strong> l&apos;espace du noyau RBF est de{" "}
            <strong className="text-ink">dimension infinie</strong> — il est impossible à
            dessiner. La surface ci-dessus (<Tex>{String.raw`z = x_1^2 + x_2^2`}</Tex>) illustre
            l&apos;<em>idée</em> du relèvement, pas l&apos;espace réellement utilisé. Ce qui est
            vrai dans les deux cas : le SVM n&apos;y transporte jamais les données, il ne calcule
            que des produits scalaires.
          </>
        ) : (
          <>
            Avec un noyau linéaire, il n&apos;y a aucune transformation : l&apos;espace de
            travail est le plan d&apos;origine. Passez en RBF ou polynomial pour voir
            l&apos;intérêt du relèvement.
          </>
        )}
        {kernel === "rbf" && (
          <span className="mt-1 block text-ink-muted">γ = {gamma.toFixed(1)}</span>
        )}
      </div>
    </div>
  );
}

function GroundGrid() {
  const lines = React.useMemo(() => {
    const out: [number, number, number][][] = [];
    for (let i = -3; i <= 3; i++) {
      out.push([
        [i, 0, -3],
        [i, 0, 3],
      ]);
      out.push([
        [-3, 0, i],
        [3, 0, i],
      ]);
    }
    return out;
  }, []);

  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={CHROME.grid} lineWidth={1} />
      ))}
      <Line
        points={[
          [-3.2, 0, 0],
          [3.2, 0, 0],
        ]}
        color={CHROME.axis}
        lineWidth={1.5}
      />
      <Line
        points={[
          [0, 0, -3.2],
          [0, 0, 3.2],
        ]}
        color={CHROME.axis}
        lineWidth={1.5}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, 4.4, 0],
        ]}
        color={CHROME.axis}
        lineWidth={1.5}
      />
    </group>
  );
}

