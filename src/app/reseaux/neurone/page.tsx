import type { Metadata } from "next";
import { NeuronLab } from "@/components/pages/NeuronLab";

export const metadata: Metadata = {
  title: "Un neurone",
  description:
    "z = w₁x₁ + w₂x₂ + b, puis a = f(z). Bougez les poids et les entrées, voyez la sortie et la droite de décision changer en direct.",
};

export default function Page() {
  return <NeuronLab />;
}
