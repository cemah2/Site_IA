import type { Metadata } from "next";
import { GradientDescentLab } from "@/components/pages/GradientDescentLab";

export const metadata: Metadata = {
  title: "Descente de gradient",
  description:
    "Une bille sur la surface de coût, les gradients dessinés, le learning rate manipulable : trop faible, correct, ou divergent.",
};

export default function Page() {
  return <GradientDescentLab />;
}
