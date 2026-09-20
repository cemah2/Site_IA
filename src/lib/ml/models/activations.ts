export type ActivationName = "sigmoid" | "tanh" | "relu" | "leakyRelu" | "linear";

export interface Activation {
  name: ActivationName;
  label: string;
  /** Applied element-wise to the pre-activation z. */
  f: (z: number) => number;
  /** Derivative expressed in terms of z. */
  df: (z: number) => number;
  formula: string;
  derivativeFormula: string;
  range: string;
  /** The one thing a learner should remember about its gradient behaviour. */
  gradientNote: string;
}

const LEAKY_SLOPE = 0.1;

export const ACTIVATIONS: Record<ActivationName, Activation> = {
  sigmoid: {
    name: "sigmoid",
    label: "Sigmoid",
    f: (z) => 1 / (1 + Math.exp(-z)),
    df: (z) => {
      const s = 1 / (1 + Math.exp(-z));
      return s * (1 - s);
    },
    formula: "\\sigma(z) = \\frac{1}{1 + e^{-z}}",
    derivativeFormula: "\\sigma'(z) = \\sigma(z)\\,\\bigl(1 - \\sigma(z)\\bigr)",
    range: "(0, 1)",
    gradientNote:
      "Sa dérivée plafonne à 0,25 et tend vers 0 dès que |z| dépasse 4. Empilez quelques couches et le gradient est multiplié par 0,25 à chaque fois : il disparaît. C'est le vanishing gradient.",
  },
  tanh: {
    name: "tanh",
    label: "Tanh",
    f: (z) => Math.tanh(z),
    df: (z) => 1 - Math.tanh(z) ** 2,
    formula: "\\tanh(z) = \\frac{e^{z} - e^{-z}}{e^{z} + e^{-z}}",
    derivativeFormula: "\\tanh'(z) = 1 - \\tanh^{2}(z)",
    range: "(-1, 1)",
    gradientNote:
      "Centrée en zéro, ce qui aide la convergence par rapport à la sigmoid. Mais sa dérivée sature aussi : même problème de gradient qui s'évanouit, simplement repoussé un peu plus loin.",
  },
  relu: {
    name: "relu",
    label: "ReLU",
    f: (z) => (z > 0 ? z : 0),
    df: (z) => (z > 0 ? 1 : 0),
    formula: "\\mathrm{ReLU}(z) = \\max(0, z)",
    derivativeFormula: "\\mathrm{ReLU}'(z) = \\begin{cases} 1 & z > 0 \\\\ 0 & z \\le 0 \\end{cases}",
    range: "[0, +∞)",
    gradientNote:
      "Dérivée exactement 1 côté positif : le gradient passe intact, quelle que soit la profondeur. C'est ce qui a rendu les réseaux profonds entraînables. Le revers : côté négatif la dérivée est 0, et un neurone bloqué là ne reçoit plus rien — il est mort.",
  },
  leakyRelu: {
    name: "leakyRelu",
    label: "Leaky ReLU",
    f: (z) => (z > 0 ? z : LEAKY_SLOPE * z),
    df: (z) => (z > 0 ? 1 : LEAKY_SLOPE),
    formula: "f(z) = \\begin{cases} z & z > 0 \\\\ 0{,}1\\,z & z \\le 0 \\end{cases}",
    derivativeFormula: "f'(z) = \\begin{cases} 1 & z > 0 \\\\ 0{,}1 & z \\le 0 \\end{cases}",
    range: "(-∞, +∞)",
    gradientNote:
      "La pente 0,1 côté négatif laisse toujours filtrer un peu de gradient : un neurone ne peut plus mourir définitivement. Un correctif d'une ligne à un vrai problème.",
  },
  linear: {
    name: "linear",
    label: "Identité",
    f: (z) => z,
    df: () => 1,
    formula: "f(z) = z",
    derivativeFormula: "f'(z) = 1",
    range: "(-∞, +∞)",
    gradientNote:
      "Aucune non-linéarité. Empiler des couches linéaires ne sert à rien : la composition de deux fonctions linéaires est linéaire. C'est la démonstration de pourquoi une activation est indispensable.",
  },
};

/** Softmax over a vector — used at the output layer, never element-wise. */
export function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const exp = z.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0) || 1;
  return exp.map((e) => e / sum);
}
