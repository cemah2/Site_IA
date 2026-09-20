import type { Metadata } from "next";
import { CompareLab } from "@/components/pages/CompareLab";

export const metadata: Metadata = {
  title: "Comparer les algorithmes",
  description:
    "Le même dataset, le même découpage, six algorithmes. Frontières, accuracy, matrices de confusion, temps d'entraînement et nombre de paramètres, côte à côte.",
};

export default function Page() {
  return <CompareLab />;
}
