import type { Metadata } from "next";
import { ReviewLab } from "@/components/pages/ReviewLab";

export const metadata: Metadata = {
  title: "Réviser",
  description:
    "Les questions du site vous reviennent au moment où elles commencent à s'effacer. Répondre à nouveau, plus tard, est ce qui fait tenir un apprentissage.",
};

export default function Page() {
  return <ReviewLab />;
}
