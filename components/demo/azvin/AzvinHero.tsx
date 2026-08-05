"use client";

import { useCallback, useEffect, useState } from "react";
import { AzvinMobileCheckout } from "@/components/demo/azvin/AzvinMobileCheckout";
import {
  getAzvinHeroCopy,
  sumAzvinSelectedAzn,
  type AzvinLocale,
  type AzvinServiceId,
} from "@/lib/azvin-hero-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import styles from "@/app/[locale]/demo/azvin/azvin.module.css";

export function AzvinHero() {
  const [locale, setLocale] = useState<AzvinLocale>("az");
  const [selected, setSelected] = useState<Set<AzvinServiceId>>(() => new Set());
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale((next) => {
      setLocale(next);
      setGlobalError(null);
      setDemoNote(null);
      setVinError(null);
    });
  }, []);

  const copy = getAzvinHeroCopy(locale);
  const totalAzn = sumAzvinSelectedAzn(selected);

  const onToggleService = useCallback((id: AzvinServiceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGlobalError(null);
    setDemoNote(null);
  }, []);

  const onSubmit = useCallback(() => {
    setGlobalError(null);
    setDemoNote(null);

    if (totalAzn <= 0) {
      setGlobalError(copy.ctaSelectHint);
      return;
    }

    const normalized = normalizeVin(vin);
    if (!isValidVinOrPlate(normalized)) {
      setVinError(copy.vinInvalid);
      setGlobalError(copy.vinInvalid);
      return;
    }
    setVinError(null);
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setDemoNote(copy.ctaDemoNote);
    }, 400);
  }, [copy.ctaDemoNote, copy.ctaSelectHint, copy.vinInvalid, totalAzn, vin]);

  return (
    <section id="azvin-hero" className={styles.page} aria-labelledby="azvin-hero-title">
      <div className={styles.heroShell}>
        <AzvinMobileCheckout
          copy={copy}
          selected={selected}
          onToggleService={onToggleService}
          totalAzn={totalAzn}
          vin={vin}
          vinError={vinError}
          globalError={globalError}
          demoNote={demoNote}
          loading={loading}
          onVinChange={setVin}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  );
}
