/**
 * Check every challenge on the Défis page is actually winnable, and that its
 * starting settings do NOT already win.
 *
 * A goal nobody can reach is worse than no goal at all, and a goal that is
 * already met on arrival teaches nothing — so both are failures here.
 */
import { generateDataset, splitDataset } from "../src/lib/ml/datasets";
import { evaluate } from "../src/lib/ml/metrics";
import { DEFAULT_PARAMS, fitModel, type AlgoId, type AlgoParams } from "../src/lib/ml/registry";

interface Case {
  name: string;
  dataset: Parameters<typeof generateDataset>[0];
  algo: AlgoId;
  initial: Partial<AlgoParams>;
  grid: Partial<AlgoParams>[];
  goal: (r: { testAcc: number; trainAcc: number }) => boolean;
  goalLabel: string;
}

const run = (c: Case, params: Partial<AlgoParams>) => {
  const ds = generateDataset(c.dataset);
  const { train, test } = splitDataset(ds, 0.65, 555);
  const { model } = fitModel(c.algo, train, ds.classNames.length, {
    ...DEFAULT_PARAMS,
    ...params,
  });
  return {
    trainAcc: evaluate(model, train, ds.classNames).accuracy,
    testAcc: evaluate(model, test, ds.classNames).accuracy,
  };
};

const cases: Case[] = [
  {
    name: "Trouvez le bon K",
    dataset: { kind: "moons", n: 200, noise: 0.4, seed: 17, nClasses: 2 },
    algo: "knn",
    initial: { k: 1 },
    grid: Array.from({ length: 60 }, (_, i) => ({ k: i + 1 })),
    goal: (r) => r.testAcc >= 0.9,
    goalLabel: "test >= 90%",
  },
  {
    name: "Résolvez les spirales",
    dataset: { kind: "spirals", n: 300, noise: 0.06, seed: 9, nClasses: 3 },
    algo: "mlp",
    initial: { hidden: [4], activation: "tanh", epochs: 100, learningRate: 0.3 },
    grid: ["4", "16", "20-16", "24-16-12"].flatMap((arch) =>
      [0.05, 0.15, 0.3].flatMap((learningRate) =>
        [100, 300, 500, 700, 900].map((epochs) => ({
          hidden: arch.split("-").map(Number),
          activation: "tanh" as const,
          epochs,
          learningRate,
        })),
      ),
    ),
    goal: (r) => r.testAcc >= 0.88,
    goalLabel: "test >= 88%",
  },
  {
    name: "Rendez ce problème séparable",
    dataset: { kind: "circles", n: 200, noise: 0.12, seed: 4, nClasses: 2 },
    algo: "svm",
    initial: { kernel: "linear", gamma: 1, C: 1 },
    grid: (["linear", "rbf", "poly"] as const).flatMap((kernel) =>
      [0.1, 0.5, 1, 2, 3, 4, 5, 6].flatMap((gamma) =>
        [0.01, 0.1, 1, 10, 100].map((C) => ({ kernel, gamma, C })),
      ),
    ),
    goal: (r) => r.testAcc >= 0.98,
    goalLabel: "test >= 98%",
  },
  {
    name: "Un arbre qui ne triche pas",
    dataset: { kind: "moons", n: 160, noise: 0.3, seed: 23, nClasses: 2 },
    algo: "tree",
    initial: { maxDepth: 12, minSamplesLeaf: 1 },
    grid: Array.from({ length: 12 }, (_, d) =>
      Array.from({ length: 30 }, (_, l) => ({ maxDepth: d + 1, minSamplesLeaf: l + 1 })),
    ).flat(),
    goal: (r) => r.testAcc >= 0.86 && r.trainAcc - r.testAcc < 0.08,
    goalLabel: "test >= 86% et écart < 8 pts",
  },
];

let failures = 0;
for (const c of cases) {
  const start = run(c, c.initial);
  const wins = c.grid.filter((g) => c.goal(run(c, g)));
  const startWins = c.goal(start);
  const best = c.grid
    .map((g) => ({ g, r: run(c, g) }))
    .reduce((a, b) => (b.r.testAcc > a.r.testAcc ? b : a));

  const ok = wins.length > 0 && !startWins;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${c.name}\n` +
      `      objectif : ${c.goalLabel}\n` +
      `      départ   : test ${(start.testAcc * 100).toFixed(1)}% / train ${(start.trainAcc * 100).toFixed(1)}%` +
      `${startWins ? "  <-- gagne déjà au départ" : ""}\n` +
      `      réglages gagnants : ${wins.length} / ${c.grid.length}\n` +
      `      meilleur : test ${(best.r.testAcc * 100).toFixed(1)}%  ${JSON.stringify(best.g)}`,
  );
}

console.log(failures ? `\n${failures} défi(s) mal calibré(s)` : "\nTous les défis sont calibrés");
process.exit(failures ? 1 : 0);
