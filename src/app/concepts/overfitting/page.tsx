import type { Metadata } from "next";
import { OverfittingLab } from "@/components/pages/OverfittingLab";

export const metadata: Metadata = {
  title: "Sur / sous-apprentissage",
  description:
    "Augmentez la complexité du modèle et regardez l'erreur de validation remonter alors que l'erreur d'entraînement continue de descendre.",
};

export default function Page() {
  return <OverfittingLab />;
}
