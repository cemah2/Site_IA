import type { Metadata } from "next";
import { ActivationsLab } from "@/components/pages/ActivationsLab";

export const metadata: Metadata = {
  title: "Fonctions d'activation",
  description:
    "Sigmoid, Tanh, ReLU, Leaky ReLU, Softmax : courbe, dérivée, domaine, et l'effet concret sur la disparition du gradient en profondeur.",
};

export default function Page() {
  return <ActivationsLab />;
}
