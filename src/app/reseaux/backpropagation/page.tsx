import type { Metadata } from "next";
import { BackpropLab } from "@/components/pages/BackpropLab";

export const metadata: Metadata = {
  title: "Backpropagation",
  description:
    "Prédiction → loss → gradient → remontée → mise à jour des poids. Chaque δ affiché, chaque poids avant et après une itération.",
};

export default function Page() {
  return <BackpropLab />;
}
