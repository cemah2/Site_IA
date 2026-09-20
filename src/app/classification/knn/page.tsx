import type { Metadata } from "next";
import { KnnLab } from "@/components/pages/KnnLab";

export const metadata: Metadata = {
  title: "K-Nearest Neighbors",
  description:
    "KNN sans apprentissage : tout se passe au moment de prédire. Voisins mis en évidence, distances mesurées, vote majoritaire et effet de K sur la frontière.",
};

export default function Page() {
  return <KnnLab />;
}
