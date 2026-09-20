import type { Metadata } from "next";
import { SpaceLab } from "@/components/pages/SpaceLab";

export const metadata: Metadata = {
  title: "Espace 2D / 3D",
  description:
    "Hyperplan, projection, distance, clusters : les notions qui ne se comprennent qu'en tournant autour du nuage.",
};

export default function Page() {
  return <SpaceLab />;
}
