"use client";

import { AUTOPARKS_OWNER_LV } from "@/lib/iriss-autoparks";
import { V2_REGISTRY_STATUS_LV, type AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { fmtDateLv, fmtKm } from "@/lib/iriss-autoparks-v2-format";

/** CSDD reģistrs (j63 / m03): sava kabineta cilne. Tikai lasāms, zaļš punkts = no CSDD. */
export function AutoparksV2Csdd({ basics }: { basics: AutoparksV2Basics }) {
  const reg = basics.registry;
  const row = (label: string, shown: string, csdd: boolean) => (
    <div className="ap2-f">
      <i className={`ap2-cd ${csdd && shown ? "on" : ""}`} />
      <span className="k">{label}</span>
      <span className={`v ${shown ? "" : "mut"}`}>{shown || "-"}</span>
    </div>
  );

  return (
    <div className="ap2-pane">
      <div className="ap2-card">
        {row("Reģ. numurs", basics.plate, Boolean(basics.plate && reg.known))}
        {row("Nobraukums", fmtKm(basics.mileageKm.value), basics.mileageKm.csdd)}
        {row("Statuss", V2_REGISTRY_STATUS_LV[reg.status], reg.known)}
        {row("Īpašnieks", AUTOPARKS_OWNER_LV[basics.owner], reg.known)}
        {row("Akts", [reg.actNo, fmtDateLv(reg.actDate)].filter(Boolean).join(" · "), Boolean(reg.actNo || reg.actDate))}
      </div>
    </div>
  );
}
