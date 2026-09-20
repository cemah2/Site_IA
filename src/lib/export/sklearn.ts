import type { AlgoId, AlgoParams } from "@/lib/ml/registry";
import type { DatasetId } from "@/lib/ml/datasets";
import type { Dataset } from "@/lib/ml/types";

/**
 * The code that reproduces what is currently on screen.
 *
 * A generic "here is how scikit-learn works" snippet teaches nothing a tutorial
 * does not. What is worth having is the snippet for *this* experiment: the
 * dataset the reader just configured, the model they just chose, the
 * hyperparameters they just moved. That turns "I understood the idea" into "I
 * can run it tonight", which is the one gap this site cannot close by itself.
 *
 * Everything emitted is real scikit-learn, and deliberately includes the two
 * things beginners leave out: a held-out split, and a Pipeline so that scaling
 * is fitted on the training fold only.
 */

export interface SnippetOptions {
  algo: AlgoId;
  params: AlgoParams;
  dataset: Dataset;
  kind: DatasetId;
  n: number;
  noise: number;
  seed: number;
  nClasses: number;
  trainRatio: number;
  /** Set when the reader imported a file: the snippet then reads their CSV. */
  imported: boolean;
  crossValidated: boolean;
  /** Wrap the estimator in a Pipeline with StandardScaler. */
  scaled: boolean;
}

interface Estimator {
  imports: string[];
  expression: string;
  note: string;
}

function estimatorFor(algo: AlgoId, p: AlgoParams): Estimator {
  switch (algo) {
    case "centroid":
      return {
        imports: ["from sklearn.neighbors import NearestCentroid"],
        expression: "NearestCentroid()",
        note: "Aucun hyperparamètre : le modèle est entièrement déterminé par les données.",
      };
    case "knn":
      return {
        imports: ["from sklearn.neighbors import KNeighborsClassifier"],
        expression: `KNeighborsClassifier(n_neighbors=${p.k}${p.weighted ? ', weights="distance"' : ""})`,
        note: 'n_neighbors est le K de la page ; weights="distance" est le vote pondéré.',
      };
    case "bayes":
      return {
        imports: ["from sklearn.naive_bayes import GaussianNB"],
        expression: "GaussianNB()",
        note: "La variante gaussienne : une loi normale par classe et par feature, comme la page.",
      };
    case "tree":
      return {
        imports: ["from sklearn.tree import DecisionTreeClassifier"],
        expression: `DecisionTreeClassifier(max_depth=${p.maxDepth}, min_samples_leaf=${p.minSamplesLeaf}, criterion="${p.criterion}", random_state=0)`,
        note: "min_samples_leaf est le garde-fou contre le surapprentissage vu sur la page des arbres.",
      };
    case "forest":
      return {
        imports: ["from sklearn.ensemble import RandomForestClassifier"],
        expression: `RandomForestClassifier(n_estimators=${p.nTrees}, max_depth=${p.maxDepth}, min_samples_leaf=${p.minSamplesLeaf}, random_state=0, n_jobs=-1)`,
        note: "n_jobs=-1 entraîne les arbres en parallèle : ils sont indépendants, c'est tout le principe du bagging.",
      };
    case "svm":
      return {
        imports: ["from sklearn.svm import SVC"],
        expression: `SVC(C=${p.C}, kernel="${p.kernel}"${p.kernel === "rbf" ? `, gamma=${p.gamma}` : ""}${p.kernel === "poly" ? `, degree=${p.degree}` : ""})`,
        note: "Le SVM ne met pas les features à l'échelle tout seul : gardez le Pipeline coché.",
      };
    case "mlp":
      return {
        imports: ["from sklearn.neural_network import MLPClassifier"],
        expression: `MLPClassifier(hidden_layer_sizes=(${p.hidden.join(", ")}${p.hidden.length === 1 ? "," : ""}), activation="${p.activation === "sigmoid" ? "logistic" : p.activation}", learning_rate_init=${p.learningRate}, max_iter=${Math.max(200, p.epochs)}, random_state=0)`,
        note: 'activation="logistic" est le nom scikit-learn de la sigmoïde.',
      };
    default:
      return {
        imports: ["from sklearn.linear_model import LogisticRegression"],
        expression: "LogisticRegression()",
        note: "Le modèle de la page « régression logistique ».",
      };
  }
}

function dataBlock(o: SnippetOptions): { imports: string[]; code: string } {
  if (o.imported) {
    const [fx, fy] = o.dataset.featureNames;
    return {
      imports: ["import pandas as pd"],
      code: [
        'df = pd.read_csv("vos_donnees.csv")   # le fichier que vous avez importé',
        `X = df[["${fx}", "${fy}"]].to_numpy()`,
        'y = df["classe"].to_numpy()           # mettez le nom de votre colonne',
      ].join("\n"),
    };
  }

  const generators: Partial<Record<DatasetId, { imp: string; call: string }>> = {
    moons: {
      imp: "from sklearn.datasets import make_moons",
      call: `make_moons(n_samples=${o.n}, noise=${o.noise}, random_state=${o.seed})`,
    },
    circles: {
      imp: "from sklearn.datasets import make_circles",
      call: `make_circles(n_samples=${o.n}, noise=${o.noise}, factor=0.5, random_state=${o.seed})`,
    },
    blobs: {
      imp: "from sklearn.datasets import make_blobs",
      call: `make_blobs(n_samples=${o.n}, centers=${o.nClasses}, cluster_std=${(0.6 + o.noise).toFixed(2)}, random_state=${o.seed})`,
    },
    gaussian: {
      imp: "from sklearn.datasets import make_blobs",
      call: `make_blobs(n_samples=${o.n}, centers=${o.nClasses}, cluster_std=${(0.8 + o.noise).toFixed(2)}, random_state=${o.seed})`,
    },
    linear: {
      imp: "from sklearn.datasets import make_classification",
      call: `make_classification(n_samples=${o.n}, n_features=2, n_redundant=0, n_informative=2, n_clusters_per_class=1, flip_y=${(o.noise / 4).toFixed(3)}, random_state=${o.seed})`,
    },
  };

  const gen = generators[o.kind];
  if (gen) return { imports: [gen.imp], code: `X, y = ${gen.call}` };

  // Spirals, XOR and the rest have no scikit-learn generator. Saying so beats
  // emitting a call that does not exist.
  return {
    imports: ["import numpy as np"],
    code: [
      `# « ${o.dataset.name} » n'a pas d'équivalent tout fait dans scikit-learn.`,
      "# Reconstruisez le nuage à la main, ou partez d'un CSV à vous.",
      "X, y = np.array([]), np.array([])",
    ].join("\n"),
  };
}

export function sklearnSnippet(o: SnippetOptions): string {
  const est = estimatorFor(o.algo, o.params);
  const data = dataBlock(o);

  const imports = new Set<string>([...data.imports, ...est.imports]);
  imports.add("from sklearn.model_selection import train_test_split");
  if (o.crossValidated) imports.add("from sklearn.model_selection import cross_val_score");
  if (o.scaled) {
    imports.add("from sklearn.pipeline import make_pipeline");
    imports.add("from sklearn.preprocessing import StandardScaler");
  }

  const model = o.scaled ? `make_pipeline(StandardScaler(), ${est.expression})` : est.expression;

  const lines = [
    ...[...imports].sort(),
    "",
    data.code,
    "",
    `# ${Math.round(o.trainRatio * 100)} % pour apprendre, le reste jamais vu par le modèle.`,
    "X_train, X_test, y_train, y_test = train_test_split(",
    `    X, y, train_size=${o.trainRatio}, stratify=y, random_state=0`,
    ")",
    "",
  ];

  if (o.scaled) {
    lines.push(
      "# Le Pipeline n'est pas une coquetterie : il garantit que la mise à",
      "# l'échelle est calculée sur les seules données d'entraînement, y compris",
      "# dans chaque pli de la validation croisée. C'est la parade à la fuite.",
    );
  }

  lines.push(`model = ${model}`, "model.fit(X_train, y_train)", "");

  if (o.crossValidated) {
    lines.push(
      "scores = cross_val_score(model, X, y, cv=5)",
      'print(f"validation croisée : {scores.mean():.3f} ± {scores.std():.3f}")',
      "",
      "# Le jeu de test ne sert qu'une fois, à la toute fin :",
      'print(f"test : {model.score(X_test, y_test):.3f}")',
    );
  } else {
    lines.push('print(f"test : {model.score(X_test, y_test):.3f}")');
  }

  return lines.join("\n");
}

/** The one-line note explaining the estimator's arguments. */
export function estimatorNote(algo: AlgoId, params: AlgoParams): string {
  return estimatorFor(algo, params).note;
}
