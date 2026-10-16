"use client";

import { useEffect, useState } from "react";

import { vinScanUserscriptMinLabel, vinScanUserscriptUpdateNeeded } from "@/lib/vin-scan/catalog";

/** Rāda brīdinājumu, ja admin lapā ieslēgtais PROVIN skripts ir vecāks par VIN SCAN minimumu. */
export function AdminUserscriptUpdateHint({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const read = () => document.documentElement.getAttribute("data-provin-userscript") || "";
    setVersion(read());
    const obs = new MutationObserver(() => setVersion(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-provin-userscript"] });
    const timer = window.setTimeout(() => setSettled(true), 1500);
    return () => {
      obs.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const min = vinScanUserscriptMinLabel();
  const box = `mb-2 rounded-md border border-amber-700/30 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-[var(--color-apple-text)] ${className}`;
  if (version && vinScanUserscriptUpdateNeeded(version)) {
    return (
      <p className={box}>
        PROVIN skripts ir vecāks par {min} (tagad {version}). Atjauniniet Tampermonkey, lai stat.vin ielādētos no jūsu pārlūka un izsoļu arhīvs un Zviedrijas reģistrs importētos.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  if (settled && !version) {
    return (
      <p className={box}>
        PROVIN skripts nav aktīvs. stat.vin dati jāielādē no jūsu pārlūka, serveris šo lapu vairs nesaņem. Ieslēdziet Tampermonkey un atsvaidziniet šo lapu.{" "}
        <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
          Lejupielādēt {min}
        </a>
      </p>
    );
  }
  return null;
}
