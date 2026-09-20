import type { Metadata } from "next";
import { NearestCentroidLab } from "@/components/pages/NearestCentroidLab";

export const metadata: Metadata = {
  title: "Nearest Centroid",
  description:
    "Le modèle le plus simple qui apprenne vraiment : un point par classe. Distances euclidiennes tracées et recalculées en direct.",
};

export default function Page() {
  return <NearestCentroidLab />;
}
