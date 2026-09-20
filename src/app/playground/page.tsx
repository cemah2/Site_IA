import type { Metadata } from "next";
import { PlaygroundLab } from "@/components/pages/PlaygroundLab";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Choisissez un dataset, un algorithme, réglez ses paramètres, entraînez, analysez. Avec une lecture automatique de ce que le résultat signifie.",
};

export default function Page() {
  return <PlaygroundLab />;
}
