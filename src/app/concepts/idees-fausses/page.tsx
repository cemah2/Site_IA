import type { Metadata } from "next";
import { MythsLab } from "@/components/pages/MythsLab";

export const metadata: Metadata = {
  title: "Idées fausses",
  description:
    "Six affirmations que presque tout le monde tient pour vraies, jugées puis tranchées par une mesure calculée pendant que vous lisez.",
};

export default function Page() {
  return <MythsLab />;
}
