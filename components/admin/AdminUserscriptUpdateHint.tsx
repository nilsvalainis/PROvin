"use client";

import { useEffect, useState } from "react";

import { vinScanUserscriptMinLabel, vinScanUserscriptUpdateNeeded } from "@/lib/vin-scan/catalog";

/** Rāda brīdinājumu, ja admin lapā ieslēgtais PROVIN skripts ir vecāks par VIN SCAN minimumu. */
export function AdminUserscriptUpdateHint({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    const read = () => document.documentElement.getAttribute("data-provin-userscript") || "";
    setVersion(read());
    const obs = new MutationObserver(() => setVersion(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-provin-userscript"] });
    return () => obs.disconnect();
  }, []);

  if (!vinScanUserscriptUpdateNeeded(version)) return null;
  const min = vinScanUserscriptMinLabel();
  return (
    <p className={`mb-2 rounded-md border border-amber-700/30 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-[var(--color-apple-text)] ${className}`}>
      PROVIN skripts ir vecāks par {min} (tagad {version}). Atjauniniet Tampermonkey, lai izsoļu arhīvs importētos no pārlūka.{" "}
      <a className="underline" href="/userscripts/provin-vin-autofill.user.js">
        Lejupielādēt {min}
      </a>
    </p>
  );
}
