"use client";

import { useState } from "react";
import { lvDaysAccusative, type RegistryFreshness } from "@/lib/iriss-autoparks-registry-freshness";

/** CSDD reģistra svaigums (makets 17.11): punkts + teksts. Zaļš / dzeltens / sarkans / pelēks (nav datu). */
export function RegistryFreshText({ fresh, prefix = "" }: { fresh: RegistryFreshness; prefix?: string }) {
  return (
    <span className={`ap2-fresh ${fresh.tone}`} title="Kad pēdējo reizi nolasīts CSDD tirdzniecības reģistrs">
      <i aria-hidden />
      <span>
        {prefix}
        {fresh.label}
      </span>
    </span>
  );
}

/** Sarkanā josla saraksta augšā, ja reģistrs nav nolasīts ilgāk par nedēļu. Neaizverama, kamēr dati nav atjaunoti. */
export function RegistryStaleBanner({ fresh }: { fresh: RegistryFreshness }) {
  const [help, setHelp] = useState(false);
  if (fresh.tone !== "bad" || fresh.ageDays == null) return null;
  return (
    <div className="ap2-stale" role="alert">
      <span className="ic" aria-hidden>
        !
      </span>
      <div className="tx">
        <b>CSDD reģistra dati nav atjaunoti {lvDaysAccusative(fresh.ageDays)}</b>
        <p>
          {/* "09.11." jau beidzas ar punktu - otru neliek. */}
          Pēdējo reizi {fresh.lastLabel.endsWith(".") ? fresh.lastLabel : `${fresh.lastLabel}.`} Akta nr. un statusi var būt veci, jaunie pieņemtie auto var neparādīties. Pirms pavadzīmes vai
          pārdošanas pārbaudi e-CSDD.
        </p>
        {help ? (
          <p className="help">
            Ziņo Andrim: nakts nolasījums no CSDD (Hetzner) nav atsūtījis datus. Rezerves ceļš - Aivars ieliek reģistra failu Dropbox mapē
            CSDD_registrs_IRISS, un Autoparks to paņem nākamajā rītā.
          </p>
        ) : null}
      </div>
      <button type="button" className="act" aria-expanded={help} onClick={() => setHelp((v) => !v)}>
        {help ? "Aizvērt" : "Kas jādara?"}
      </button>
    </div>
  );
}
