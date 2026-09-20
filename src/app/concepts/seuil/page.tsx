import type { Metadata } from "next";
import { ThresholdLab } from "@/components/pages/ThresholdLab";

export const metadata: Metadata = {
  title: "Le seuil de décision",
  description:
    "Un modèle ne répond pas « oui », il répond « 0,63 ». Où couper est un choix séparé, qui dépend de ce que coûtent vos erreurs : précision, rappel, ROC et coût des oublis.",
};

export default function Page() {
  return <ThresholdLab />;
}
