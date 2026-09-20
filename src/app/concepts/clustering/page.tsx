import type { Metadata } from "next";
import { ClusteringLab } from "@/components/pages/ClusteringLab";

export const metadata: Metadata = {
  title: "Clustering",
  description:
    "Apprendre sans étiquettes : K-means pas à pas, avec l'inertie, la sensibilité à l'initialisation et la méthode du coude.",
};

export default function Page() {
  return <ClusteringLab />;
}
