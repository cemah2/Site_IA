"use client";

import * as React from "react";
import type { TreeNode } from "@/lib/ml/models/decision-tree";
import { classColor, CHROME } from "@/lib/viz/palette";

interface Laid {
  node: TreeNode;
  x: number;
  y: number;
}

const NODE_W = 92;
const NODE_H = 40;
const GAP_X = 14;
const GAP_Y = 54;

/**
 * Layout: leaves are placed left to right at a fixed pitch, and every internal
 * node is centred over its two children. That is the classic tidy-tree rule and
 * it keeps the picture readable without a full Reingold–Tilford pass, which
 * would only pay off on trees far deeper than a learner can follow anyway.
 */
function layout(root: TreeNode): { nodes: Laid[]; width: number; height: number } {
  const nodes: Laid[] = [];
  let leafCursor = 0;
  let maxDepth = 0;

  const walk = (node: TreeNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (node.left && node.right) {
      const lx = walk(node.left, depth + 1);
      const rx = walk(node.right, depth + 1);
      x = (lx + rx) / 2;
    } else {
      x = leafCursor * (NODE_W + GAP_X) + NODE_W / 2;
      leafCursor += 1;
    }
    nodes.push({ node, x, y: depth * (NODE_H + GAP_Y) + NODE_H / 2 });
    return x;
  };

  walk(root, 0);
  return {
    nodes,
    width: Math.max(1, leafCursor) * (NODE_W + GAP_X),
    height: (maxDepth + 1) * (NODE_H + GAP_Y),
  };
}

/**
 * The tree itself.
 *
 * Every node shows its class distribution as a stacked bar rather than just its
 * majority label, because "which class wins here" and "by how much" are
 * different facts, and the second one is what impurity measures. A node that is
 * 51/49 and a node that is 100/0 both read "class A" without the bar.
 */
export function TreeDiagram({
  root,
  classNames,
  selectedId,
  onSelect,
  pathIds,
  className,
}: {
  root: TreeNode;
  classNames: string[];
  selectedId?: number | null;
  onSelect?: (node: TreeNode) => void;
  /** Node ids on the current prediction path, highlighted end to end. */
  pathIds?: Set<number>;
  className?: string;
}) {
  const { nodes, width, height } = React.useMemo(() => layout(root), [root]);
  const byId = React.useMemo(() => new Map(nodes.map((l) => [l.node.id, l])), [nodes]);
  const pad = 14;

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      <svg
        width={width + pad * 2}
        height={height + pad}
        viewBox={`${-pad} ${-pad / 2} ${width + pad * 2} ${height + pad}`}
        role="img"
        aria-label="Arbre de décision"
        className="block"
      >
        {/* Edges first, so nodes paint over their endpoints. */}
        {nodes.map(({ node, x, y }) => {
          if (!node.left || !node.right) return null;
          return [node.left, node.right].map((child, i) => {
            const c = byId.get(child.id);
            if (!c) return null;
            const onPath = pathIds?.has(node.id) && pathIds?.has(child.id);
            const midY = y + NODE_H / 2 + GAP_Y / 2;
            return (
              <g key={`${node.id}-${child.id}`}>
                <path
                  d={`M${x},${y + NODE_H / 2}V${midY}H${c.x}V${c.y - NODE_H / 2}`}
                  fill="none"
                  stroke={onPath ? CHROME.accent : CHROME.lineStrong}
                  strokeWidth={onPath ? 2 : 1.25}
                  opacity={onPath ? 1 : 0.8}
                />
                <text
                  x={(x + c.x) / 2}
                  y={midY - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={onPath ? CHROME.accent : CHROME.inkMuted}
                  style={{ paintOrder: "stroke", stroke: CHROME.plane, strokeWidth: 3 }}
                >
                  {i === 0 ? "oui" : "non"}
                </text>
              </g>
            );
          });
        })}

        {nodes.map(({ node, x, y }) => {
          const isLeaf = !node.left;
          const selected = selectedId === node.id;
          const onPath = pathIds?.has(node.id);
          const total = node.nSamples || 1;
          let offset = 0;

          return (
            <g
              key={node.id}
              onClick={() => onSelect?.(node)}
              style={{ cursor: onSelect ? "pointer" : undefined }}
            >
              <rect
                x={x - NODE_W / 2}
                y={y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={selected ? CHROME.surface3 : CHROME.surface2}
                stroke={
                  selected ? CHROME.accent : onPath ? CHROME.accent : CHROME.line
                }
                strokeWidth={selected ? 2 : onPath ? 1.5 : 1}
                opacity={onPath || !pathIds ? 1 : 0.55}
              />

              {/* Class distribution, as a 2px-gapped stacked bar. */}
              <g>
                {node.counts.map((count, c) => {
                  if (!count) return null;
                  const w = (count / total) * (NODE_W - 12);
                  const el = (
                    <rect
                      key={c}
                      x={x - NODE_W / 2 + 6 + offset}
                      y={y - NODE_H / 2 + 6}
                      width={Math.max(0, w - 2)}
                      height={4}
                      rx={2}
                      fill={classColor(c)}
                    />
                  );
                  offset += w;
                  return el;
                })}
              </g>

              <text
                x={x}
                y={y + 2}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={CHROME.ink}
                className="tnum"
              >
                {isLeaf
                  ? `→ ${classNames[node.prediction] ?? "?"}`
                  : `${node.feature === 0 ? "x₁" : "x₂"} ≤ ${node.threshold!.toFixed(2)}`}
              </text>
              <text
                x={x}
                y={y + 13}
                textAnchor="middle"
                fontSize={8.5}
                fill={CHROME.inkMuted}
                className="tnum"
              >
                n={node.nSamples} · {node.impurity.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
