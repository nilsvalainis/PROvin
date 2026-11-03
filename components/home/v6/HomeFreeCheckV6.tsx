"use client";

import { useLocale } from "next-intl";
import { VinDecoderTool, type VinDecoderLabels } from "@/components/vin-decoder/VinDecoderTool";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";
import { FREE_EVAL_PREFILL_EVENT, type FreeEvalPrefillDetail } from "@/lib/free-eval-prefill";
import { requestHeroPrefill } from "@/lib/hero-prefill";
import { FREE_EVAL_SECTION_ID } from "@/lib/paths";
import styles from "./sections-v6.module.css";

function openListing(detail: FreeEvalPrefillDetail) {
  window.dispatchEvent(new CustomEvent<FreeEvalPrefillDetail>(FREE_EVAL_PREFILL_EVENT, { detail }));
  window.requestAnimationFrame(() => {
    const el = document.getElementById(FREE_EVAL_SECTION_ID);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}

/**
 * «Bezmaksas VIN koda pārbaude»: VIN vai numurzīme turpat lapā (ielāde, rezultāts, kļūda, nav atrasts -
 * VinDecoderTool), rezultāts nodod VIN uz hero pasūtījumu vai bezmaksas sludinājuma formu.
 */
export function HomeFreeCheckV6({ decoderLabels, home }: { decoderLabels: VinDecoderLabels; home: string }) {
  const locale = useLocale();
  const c = getHomeV6HeroCopy(locale).freeCheck;
  return (
    <section id="bezmaksas-vin" className={`${styles.section} ${styles.freeCheck}`} aria-labelledby="bezmaksas-vin-h">
      <div className={styles.wrap}>
        <h2 id="bezmaksas-vin-h" className={`${styles.h2} ${styles.center}`}>
          {c.title}
        </h2>
        <p className={`${styles.lead} ${styles.center}`}>
          <b className={styles.leadQ}>{c.question}</b> {c.lead}
        </p>
        <div className={styles.freeTool}>
          <VinDecoderTool
            locale={locale}
            labels={{ ...decoderLabels, submit: c.button }}
            home={home}
            source="home"
            onAudit={(q, plan) => requestHeroPrefill({ vin: q, plan })}
            onListing={(listingUrl, q) => openListing({ listingUrl, vin: q })}
          />
        </div>
        <p className={styles.freeNote}>
          {c.note}{" "}
          <button type="button" className={styles.textBtn} onClick={() => openListing({ listingUrl: "" })}>
            {c.listing} →
          </button>
        </p>
      </div>
    </section>
  );
}
