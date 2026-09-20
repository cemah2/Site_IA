import type { Metadata } from "next";
import { ChallengesLab } from "@/components/pages/ChallengesLab";

export const metadata: Metadata = {
  title: "Défis",
  description:
    "Des problèmes à résoudre vous-même : trouver le bon K, une architecture qui résout les spirales, un modèle qui ne surapprend pas.",
};

export default function Page() {
  return <ChallengesLab />;
}
