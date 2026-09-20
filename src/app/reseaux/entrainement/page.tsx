import type { Metadata } from "next";
import { TrainingLab } from "@/components/pages/TrainingLab";

export const metadata: Metadata = {
  title: "Entraînement",
  description:
    "Loss et accuracy epoch par epoch, frontière de décision qui se forme, poids qui évoluent : tout simultanément, en direct.",
};

export default function Page() {
  return <TrainingLab />;
}
