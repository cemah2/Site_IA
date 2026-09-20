import type { Metadata } from "next";
import { DatasetsLab } from "@/components/pages/DatasetsLab";

export const metadata: Metadata = {
  title: "Datasets",
  description:
    "Dix formes de données, chacune choisie pour casser une hypothèse précise. Avec une mesure de la difficulté qu'elles posent à un modèle linéaire.",
};

export default function Page() {
  return <DatasetsLab />;
}
