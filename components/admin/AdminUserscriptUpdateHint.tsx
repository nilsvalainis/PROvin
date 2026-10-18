"use client";

import { useEffect, useState } from "react";

import { watchProvinUserscript } from "@/lib/provin-userscript-presence";
import { vinScanUserscriptMinLabel, vinScanUserscriptUpdateNeeded } from "@/lib/vin-scan/catalog";

/**
 * Rāda brīdinājumu, ja admin lapā ieslēgtais PROVIN skripts ir vecāks par VIN SCAN minimumu.
 * „Nav aktīvs” tikai pēc gaidīšanas loga ar ping, jo React var noņemt `<html>` atribūtu un Tampermonkey ienāk vēlu.
 */
export function AdminUserscriptUpdateHint({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => watchProvinUserscript(setVersion, () => setSettled(true)), []);

  const min = vinScanUserscriptMinLabel();
  const box = `mb-2 rounded-md border border-amber-700/30 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-[var(--color-apple-text)] ${className}`;
  if (version && vinScanUserscriptUpdateNeeded(version)) {
    return (
      <p className={box}>
        PROVIN skripts ir vecāks par {min} (tagad {version}). Atjauniniet Tampermonkey, lai stat.vin, bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, epolicija.lt, biluppgifter.se un NICB ielādētos no jūsu pārlūka. Izsoļu arhīvs un Zviedrijas reģistrs joprojām importējas no atvērtās cilnes.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  if (settled && !version) {
    return (
      <p className={box}>
        PROVIN skripts nav aktīvs. stat.vin dati jāielādē no jūsu pārlūka, serveris šo lapu vairs nesaņem. Tas pats attiecas uz bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, epolicija.lt, biluppgifter.se un NICB. Ieslēdziet Tampermonkey un atsvaidziniet šo lapu. Chrome paplašinājuma iestatījumos jābūt ieslēgtam „Atļaut lietotāja skriptus”.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  return null;
}
