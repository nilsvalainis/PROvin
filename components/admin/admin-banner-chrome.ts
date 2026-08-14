import type { ProvinManualBannerSeverity } from "@/lib/provin-alert-banners";
import { AlertTriangle, Info } from "lucide-react";

export const BANNER_SEVERITY_OPTIONS: { id: ProvinManualBannerSeverity; label: string }[] = [
  { id: "grey", label: "Pelēks (info)" },
  { id: "yellow", label: "Dzeltens" },
  { id: "red", label: "Sarkans" },
];

/** Vienota baneru vizuālā valoda admin panelī — manuālajiem un aprēķinātajiem. */
export function bannerSeverityChrome(severity: ProvinManualBannerSeverity) {
  if (severity === "red") {
    return { bar: "border-l-[#FF4D4D] bg-[#FF4D4D]/[0.04]", ico: "text-[#FF4D4D]", Icon: AlertTriangle };
  }
  if (severity === "yellow") {
    return { bar: "border-l-[#FFC107] bg-[#FFC107]/[0.04]", ico: "text-[#FFC107]", Icon: AlertTriangle };
  }
  return { bar: "border-l-[#8e8e93] bg-[#8e8e93]/[0.08]", ico: "text-[#8e8e93]", Icon: Info };
}
