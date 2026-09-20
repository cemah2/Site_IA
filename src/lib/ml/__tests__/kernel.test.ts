import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCsv, buildDataset, summarise } from "../csv";
import { assignFolds, crossValidate } from "../crossval";
import { DIGIT_SIZE, normaliseDrawing } from "../digits";
import { generateDataset, splitDataset } from "../datasets";
import { DecisionTree } from "../models/decision-tree";
import { NeuralNet } from "../models/neural-net";
import { leastSquares, lineCost } from "../models/regression";
import { LogisticRegression, sigmoid } from "../models/logistic";
import { fitBoosting } from "../models/boosting";
import { softmax } from "../models/activations";
import { auc, confusionAt, curvePoints, metricsAt, type ScoredSample } from "../threshold";
import { DEFAULT_PARAMS } from "../registry";

/**
 * Tests for the maths, not for the pixels.
 *
 * Everything checked here has an answer that can be worked out by hand or
 * derived from a definition, which is the only kind of assertion worth making
 * about a teaching tool: if the site is going to claim that the gini of this
 * node is 0.48, the code had better agree.
 *
 * Run with: npm test
 */

test("moindres carrés : reproduit exactement une droite sans bruit", () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ id: i, x: i / 4, y: 2.5 * (i / 4) - 1 }));
  const fit = leastSquares(points);
  assert.ok(Math.abs(fit.slope - 2.5) < 1e-9, `pente ${fit.slope}`);
  assert.ok(Math.abs(fit.intercept + 1) < 1e-9, `ordonnée ${fit.intercept}`);
  assert.ok(lineCost(points, fit.slope, fit.intercept) < 1e-18);
});

test("moindres carrés : aucune droite ne bat la droite optimale", () => {
  const points = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: i / 5,
    y: 0.8 * (i / 5) + Math.sin(i * 7.31) * 0.4,
  }));
  const fit = leastSquares(points);
  const best = lineCost(points, fit.slope, fit.intercept);
  for (const da of [-0.1, -0.01, 0.01, 0.1]) {
    for (const db of [-0.1, -0.01, 0.01, 0.1]) {
      assert.ok(
        lineCost(points, fit.slope + da, fit.intercept + db) >= best - 1e-12,
        `(${da}, ${db}) fait mieux que l'optimum`,
      );
    }
  }
});

test("impureté de Gini : 18 contre 12 donne 0,48", () => {
  const samples = [
    ...Array.from({ length: 18 }, (_, i) => ({ id: i, x: [0, 0], y: 0 })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, x: [1, 1], y: 1 })),
  ];
  const tree = new DecisionTree(samples, 2, { maxDepth: 0, minSamplesLeaf: 1, criterion: "gini" });
  // The root of a depth-0 tree is a pure leaf holding every sample.
  assert.ok(Math.abs(tree.root.impurity - 0.48) < 1e-9, `gini ${tree.root.impurity}`);
});

test("sigmoïde : symétrique, bornée, et σ(2) ≈ 0,8808", () => {
  assert.equal(sigmoid(0), 0.5);
  assert.ok(Math.abs(sigmoid(2) - 0.8807970779778823) < 1e-12);
  for (const z of [-800, -5, 0, 5, 800]) {
    const p = sigmoid(z);
    assert.ok(p >= 0 && p <= 1 && Number.isFinite(p), `σ(${z}) = ${p}`);
    assert.ok(Math.abs(sigmoid(z) + sigmoid(-z) - 1) < 1e-12, `symétrie en ${z}`);
  }
});

test("softmax : somme à 1 et invariant par décalage", () => {
  const a = softmax([1, 2, 3]);
  const b = softmax([101, 102, 103]);
  assert.ok(Math.abs(a.reduce((x, y) => x + y, 0) - 1) < 1e-12);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-12, "décalage non neutre"));
});

test("régression logistique : la descente fait baisser la log-loss à chaque pas", () => {
  const ds = generateDataset({ kind: "linear", n: 120, noise: 0.2, seed: 3, nClasses: 2 });
  const model = new LogisticRegression(ds.samples, 2, { learningRate: 0.3, l2: 0 });
  let previous = model.loss();
  for (let i = 0; i < 40; i++) {
    model.step();
    const now = model.loss();
    assert.ok(now <= previous + 1e-9, `la perte est remontée : ${previous} → ${now}`);
    previous = now;
  }
});

/**
 * The one test that would have caught a wrong derivative.
 *
 * Backpropagation is the only part of this codebase whose output cannot be
 * eyeballed: a gradient that is wrong by a factor or a sign still trains, just
 * worse, and the page would teach that quietly. Comparing it against a finite
 * difference of the loss is the standard check, and it is also exactly what the
 * network pages describe — so the test doubles as a statement of the claim.
 */
test("backpropagation : les gradients collent aux différences finies", () => {
  const net = new NeuralNet({
    hidden: [5, 4],
    activation: "tanh",
    learningRate: 0.1,
    l2: 0,
    seed: 11,
    nInputs: 2,
    nOutputs: 3,
  });
  const x = [0.42, -0.73];
  const target = 2;
  const grad = net.backward(net.forward(x), target);
  const lossAt = () => -Math.log(Math.max(net.forward(x).output[target], 1e-15));
  const eps = 1e-5;
  let checked = 0;

  for (let l = 0; l < net.W.length; l++) {
    for (let j = 0; j < net.W[l].length; j++) {
      for (let i = 0; i < net.W[l][j].length; i++) {
        const original = net.W[l][j][i];
        net.W[l][j][i] = original + eps;
        const up = lossAt();
        net.W[l][j][i] = original - eps;
        const down = lossAt();
        net.W[l][j][i] = original;

        const numeric = (up - down) / (2 * eps);
        const analytic = grad.gradW[l][j][i];
        const scale = Math.max(1, Math.abs(numeric), Math.abs(analytic));
        assert.ok(
          Math.abs(numeric - analytic) / scale < 1e-6,
          `couche ${l}, poids [${j}][${i}] : analytique ${analytic}, numérique ${numeric}`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 40, `seulement ${checked} poids vérifiés`);
});

test("ROC : un classement parfait donne une AUC de 1, un classement inversé 0", () => {
  const perfect: ScoredSample[] = [
    { id: 0, score: 0.1, label: 0, x: [] },
    { id: 1, score: 0.2, label: 0, x: [] },
    { id: 2, score: 0.8, label: 1, x: [] },
    { id: 3, score: 0.9, label: 1, x: [] },
  ];
  assert.ok(Math.abs(auc(curvePoints(perfect)) - 1) < 1e-12);

  const inverted = perfect.map((s) => ({ ...s, label: (1 - s.label) as 0 | 1 }));
  assert.ok(Math.abs(auc(curvePoints(inverted))) < 1e-12);
});

test("matrice de confusion : comptages et métriques calculés à la main", () => {
  const scored: ScoredSample[] = [
    { id: 0, score: 0.9, label: 1, x: [] }, // vrai positif
    { id: 1, score: 0.6, label: 1, x: [] }, // vrai positif
    { id: 2, score: 0.55, label: 0, x: [] }, // fausse alerte
    { id: 3, score: 0.2, label: 1, x: [] }, // manqué
    { id: 4, score: 0.1, label: 0, x: [] }, // vrai négatif
  ];
  const c = confusionAt(scored, 0.5);
  assert.deepEqual(c, { tp: 2, fp: 1, fn: 1, tn: 1 });

  const m = metricsAt(scored, 0.5);
  assert.ok(Math.abs(m.precision - 2 / 3) < 1e-12);
  assert.ok(Math.abs(m.recall - 2 / 3) < 1e-12);
  assert.ok(Math.abs(m.f1 - 2 / 3) < 1e-12);
  assert.ok(Math.abs(m.accuracy - 0.6) < 1e-12);
});

test("plis stratifiés : chaque point testé une fois, proportions respectées", () => {
  const ds = generateDataset({ kind: "imbalanced", n: 200, noise: 0.2, seed: 5, nClasses: 2 });
  const k = 5;
  const folds = assignFolds(ds.samples, k, 7);
  assert.equal(folds.length, ds.samples.length);

  for (let cls = 0; cls < 2; cls++) {
    const perFold = new Array<number>(k).fill(0);
    ds.samples.forEach((s, i) => {
      if (s.y === cls) perFold[folds[i]]++;
    });
    // Round-robin dealing: fold sizes within a class differ by at most one.
    assert.ok(
      Math.max(...perFold) - Math.min(...perFold) <= 1,
      `classe ${cls} déséquilibrée entre plis : ${perFold.join(",")}`,
    );
  }
});

test("validation croisée : la moyenne tombe entre le pire et le meilleur pli", () => {
  const ds = generateDataset({ kind: "moons", n: 150, noise: 0.25, seed: 9, nClasses: 2 });
  const cv = crossValidate("knn", ds.samples, 2, DEFAULT_PARAMS, 5, 7);
  assert.equal(cv.folds.length, 5);
  assert.ok(cv.mean >= cv.min - 1e-12 && cv.mean <= cv.max + 1e-12);
  assert.ok(cv.std >= 0);
});

test("découpage : stratifié, sans recouvrement, et rien de perdu", () => {
  const ds = generateDataset({ kind: "blobs", n: 120, noise: 0.2, seed: 4, nClasses: 3 });
  const { train, test } = splitDataset(ds, 0.7, 42);
  assert.equal(train.length + test.length, ds.samples.length);
  const trainIds = new Set(train.map((s) => s.id));
  assert.ok(test.every((s) => !trainIds.has(s.id)), "un point est des deux côtés");
});

test("boosting : l'erreur d'entraînement ne remonte jamais", () => {
  const points = Array.from({ length: 90 }, (_, i) => {
    const x = -3 + (6 * i) / 89;
    return { id: i, x, y: Math.sin(x * 1.3) + Math.cos(i * 12.9898) * 0.3 };
  });
  const r = fitBoosting(points, points, {
    nTrees: 40,
    depth: 2,
    learningRate: 0.3,
    domain: [-3, 3],
  });
  for (let i = 1; i < r.stages.length; i++) {
    assert.ok(
      r.stages[i].trainMse <= r.stages[i - 1].trainMse + 1e-12,
      `pas ${i} : ${r.stages[i - 1].trainMse} → ${r.stages[i].trainMse}`,
    );
  }
});

test("CSV : export Excel français lu correctement", () => {
  const text = "﻿longueur;largeur;espèce\r\n5,1;3,5;setosa\r\n4,9;3,0;setosa\r\n6,2;3,4;virginica\r\n";
  const table = parseCsv(text);
  assert.equal(table.delimiter, ";");
  assert.equal(table.decimalComma, true);
  assert.deepEqual(table.columns, ["longueur", "largeur", "espèce"]);

  const cols = summarise(table);
  assert.equal(cols[0].numeric, true);
  assert.equal(cols[2].numeric, false);

  const built = buildDataset(table, { x: 0, y: 1, label: 2 }, "test");
  assert.equal(built.dataset.samples.length, 3);
  assert.ok(Math.abs(built.dataset.samples[0].x[0] - 5.1) < 1e-12, "virgule décimale ignorée");
});

test("CSV : un fichier sans en-tête garde toutes ses lignes", () => {
  const table = parseCsv("1.0,2.0,0\n1.5,2.2,0\n3.0,4.0,1\n");
  assert.equal(table.rows.length, 3);
  assert.equal(table.columns[0], "colonne 1");
});

test("normalisation d'un chiffre dessiné : recentré sur son centre de masse", () => {
  // A small square of ink tucked into one corner.
  const src = new Float32Array(DIGIT_SIZE * DIGIT_SIZE);
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) src[y * DIGIT_SIZE + x] = 1;

  const out = normaliseDrawing(src);
  let sum = 0;
  let cx = 0;
  let cy = 0;
  for (let y = 0; y < DIGIT_SIZE; y++) {
    for (let x = 0; x < DIGIT_SIZE; x++) {
      const v = out[y * DIGIT_SIZE + x];
      sum += v;
      cx += v * x;
      cy += v * y;
    }
  }
  assert.ok(sum > 0, "toute l'encre a disparu");
  const centre = (DIGIT_SIZE - 1) / 2;
  assert.ok(Math.abs(cx / sum - centre) < 1.2, `centre x = ${cx / sum}`);
  assert.ok(Math.abs(cy / sum - centre) < 1.2, `centre y = ${cy / sum}`);
});
