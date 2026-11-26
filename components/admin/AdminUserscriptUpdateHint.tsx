"use client";

import { useEffect, useState } from "react";

import { isUserscriptUnsupportedBrowser, watchProvinUserscript } from "@/lib/provin-userscript-presence";
import { vinScanUserscriptMinLabel, vinScanUserscriptUpdateNeeded } from "@/lib/vin-scan/catalog";

/**
 * Rāda brīdinājumu, ja admin lapā ieslēgtais PROVIN skripts ir vecāks par VIN SCAN minimumu.
 * „Nav aktīvs” tikai pēc gaidīšanas loga ar ping, jo React var noņemt `<html>` atribūtu un Tampermonkey ienāk vēlu.
 */
export function AdminUserscriptUpdateHint({
  className = "",
  showInactive = true,
}: {
  className?: string;
  /** PRO pasūtījumā „nav aktīvs” ir kļūdains signāls - rāda tikai, ja versija ir vecāka. */
  showInactive?: boolean;
}) {
  const [version, setVersion] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  /** Dažādas versijas vienā lapā: Tampermonkey ir vairākas PROVIN skripta kopijas (saraksts tikai aug). */
  const [copies, setCopies] = useState<string[]>([]);
  /** iOS/iPadOS un Safari: skripts tur nestrādā - neko nerāda (arī iPad / iPhone guļus). */
  const [unsupported, setUnsupported] = useState(true);

  useEffect(() => {
    if (isUserscriptUnsupportedBrowser()) return;
    setUnsupported(false);
    return watchProvinUserscript(
      (next) => {
        setVersion((prev) => (prev === next ? prev : next));
      },
      () => setSettled(true),
      undefined,
      (list) => setCopies((prev) => (prev.join(",") === list.join(",") ? prev : list)),
    );
  }, []);

  if (unsupported) return null;
  const min = vinScanUserscriptMinLabel();
  const box = `admin-userscript-hint mb-2 hidden rounded-md border border-amber-700/30 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-[var(--color-apple-text)] md:block ${className}`;
  if (copies.length > 1) {
    return (
      <p className={box}>
        Tampermonkey ir {copies.length} PROVIN skripta kopijas ({copies.join(", ")}). Atstājiet tikai jaunāko - citādi avoti
        ielādējas divreiz.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  if (version && vinScanUserscriptUpdateNeeded(version)) {
    return (
      <p className={box}>
        PROVIN skripts ir vecāks par {min} (tagad {version}). Atjauniniet Tampermonkey, lai stat.vin, bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, biluppgifter.se un NICB ielādētos no jūsu pārlūka. Ar jauno versiju kfzgutachten.at saraksts pasūtījumā nonāk automātiski. Izsoļu arhīvs un Zviedrijas reģistrs joprojām importējas no atvērtās cilnes.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  if (settled && !version && showInactive) {
    return (
      <p className={box}>
        PROVIN skripts nav aktīvs. stat.vin dati jāielādē no jūsu pārlūka, serveris šo lapu vairs nesaņem. Tas pats attiecas uz bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, biluppgifter.se un NICB. Ieslēdziet Tampermonkey un atsvaidziniet šo lapu. Chrome paplašinājuma iestatījumos jābūt ieslēgtam „Atļaut lietotāja skriptus”.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  return null;
}
