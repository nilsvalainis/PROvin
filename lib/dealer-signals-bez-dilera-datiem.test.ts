import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildDealerSendMessage } from "@/lib/dealer-send-message";
import {
  addManualDealerSignal,
  DEALER_SIGNAL_DEFAULT_TEXTS,
  DEALER_SIGNAL_TITLES,
  DEALER_SIGNALS_EMAIL_LINE,
  DEALER_SIGNALS_NO_DATA_INTRO,
  dealerSignalsMessageBlock,
  emptyDealerSignalsState,
  withDealerSignalsMessageBlock,
  type DealerSignalsState,
} from "@/lib/dealer-signals";

/** Nils 28.11: signālus var pievienot arī tad, kad dīlera dati nav pieejami («Datu nav (atmaksa)»). */
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/** Dīlera datu nav, admins manuāli pievieno signālus (veidne + labots teksts). */
function manualOnly(): DealerSignalsState {
  let s = addManualDealerSignal(emptyDealerSignalsState(), "incidents");
  s = addManualDealerSignal(s, "us_history");
  s = {
    ...s,
    enabled: true,
    items: s.items.map((i) => (i.kind === "us_history" ? { ...i, text: "Auto pārdots izsolē pēc plūdiem" } : i)),
  };
  return s;
}

describe("Signāli bez dīlera datiem", () => {
  it("bloks: ievads + rinda katram ķeksētajam signālam, klienta valodā", () => {
    const lv = dealerSignalsMessageBlock(manualOnly(), "lv");
    expect(lv.split("\n")[0]).toBe(DEALER_SIGNALS_NO_DATA_INTRO.lv);
    expect(lv).toContain(`- ${DEALER_SIGNAL_TITLES.incidents.lv}: ${DEALER_SIGNAL_DEFAULT_TEXTS.incidents.lv}`);
    expect(lv).toContain(`- ${DEALER_SIGNAL_TITLES.us_history.lv}: Auto pārdots izsolē pēc plūdiem`);

    // EN: labotais LV teksts bez tulkojuma -> standarta teksts angliski (nekad latviski).
    const en = dealerSignalsMessageBlock(manualOnly(), "en");
    expect(en).toContain(DEALER_SIGNALS_NO_DATA_INTRO.en);
    expect(en).toContain(`- ${DEALER_SIGNAL_TITLES.us_history.en}: ${DEALER_SIGNAL_DEFAULT_TEXTS.us_history.en}`);
    expect(en).not.toContain("plūdiem");
    // Ar tulkojumu - tulkotais teksts.
    const enTr = dealerSignalsMessageBlock(manualOnly(), "en", { us_history: "Sold at auction after a flood" });
    expect(enTr).toContain("- US history: Sold at auction after a flood");
  });

  it("izslēgts / nav ķeksēts -> bloka nav", () => {
    expect(dealerSignalsMessageBlock(null, "lv")).toBe("");
    expect(dealerSignalsMessageBlock({ ...manualOnly(), enabled: false }, "lv")).toBe("");
    const unchecked = { ...manualOnly(), items: manualOnly().items.map((i) => ({ ...i, checked: false })) };
    expect(dealerSignalsMessageBlock(unchecked, "lv")).toBe("");
  });

  it("«Datu nav (atmaksa)» e-pasts un WhatsApp: signāli pirms PROVIN AUDITA ieteikuma", () => {
    for (const channel of ["email", "whatsapp"] as const) {
      for (const lang of ["lv", "en", "ru", "de"] as const) {
        const block = dealerSignalsMessageBlock(manualOnly(), lang);
        const m = buildDealerSendMessage({ channel, situation: "no_data", b2b: false, vin: "WVWZZZ1KZAW000001", refundCents: 2499, lang, signalsBlock: block });
        expect(m.text).toContain(DEALER_SIGNALS_NO_DATA_INTRO[lang]);
        const at = m.text.indexOf(DEALER_SIGNALS_NO_DATA_INTRO[lang]);
        const audit = m.text.search(/PROVIN\s+AUDIT/i);
        if (audit >= 0) expect(at).toBeLessThan(audit);
        // Atmaksas rinda paliek pirms signāliem.
        expect(at).toBeGreaterThan(m.text.indexOf("24,99"));
        // Bez bloka - teksts kā līdz šim.
        const plain = buildDealerSendMessage({ channel, situation: "no_data", b2b: false, vin: "WVWZZZ1KZAW000001", refundCents: 2499, lang });
        expect(plain.text).not.toContain(DEALER_SIGNALS_NO_DATA_INTRO[lang]);
        expect(m.text.replace(`${block}\n\n`, "")).toBe(plain.text);
      }
    }
  });

  it("B2B «Datu nav»: signāli ir, paraksts tikai PROVIN", () => {
    const block = dealerSignalsMessageBlock(manualOnly(), "lv");
    const m = buildDealerSendMessage({ channel: "email", situation: "no_data", b2b: true, vin: "X", refundCents: 2499, lang: "lv", signalsBlock: block });
    expect(m.text).toContain(DEALER_SIGNALS_NO_DATA_INTRO.lv);
    expect(m.text).not.toMatch(/Nils Valainis/);
  });

  it("«Dati gatavi» un «Atcelts»: bloks netiek likts (gatavajam - sadaļa PDF + viena rinda)", () => {
    const block = dealerSignalsMessageBlock(manualOnly(), "lv");
    const ready = buildDealerSendMessage({ channel: "email", situation: "ready", b2b: false, vin: "X", lang: "lv", signalsLine: true, signalsBlock: block });
    expect(ready.text).not.toContain(DEALER_SIGNALS_NO_DATA_INTRO.lv);
    expect(ready.text).toContain(DEALER_SIGNALS_EMAIL_LINE.lv);
    const cancelled = buildDealerSendMessage({ channel: "email", situation: "cancelled", b2b: false, vin: "X", refundCents: 2499, lang: "lv", signalsBlock: block });
    expect(cancelled.text).not.toContain(DEALER_SIGNALS_NO_DATA_INTRO.lv);
  });

  it("ievietošana: atkārtoti nepievieno; bez AUDITA rindkopas - pirms jautājuma un paraksta", () => {
    const t = "Labdien!\n\nTeksts.\n\nJautājumi?\n\nPROVIN.LV";
    const once = withDealerSignalsMessageBlock(t, "BLOKS");
    expect(once).toBe("Labdien!\n\nTeksts.\n\nBLOKS\n\nJautājumi?\n\nPROVIN.LV");
    expect(withDealerSignalsMessageBlock(once, "BLOKS")).toBe(once);
    expect(withDealerSignalsMessageBlock(t, "  ")).toBe(t);
  });

  it("sūtīšanas logs saņem saglabātos signālus un rāda ķeksi «Signāli tekstā» tikai «Datu nav»", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toMatch(/dealerSignals: ws\.dealerSignals \?\? null/);
    const dlg = read("components/admin/AdminDealerSendDialog.tsx");
    expect(dlg).toContain("Signāli tekstā");
    expect(dlg).toMatch(/situation === "no_data" && signalsCount > 0/);
    expect(dlg).toContain("signalsBlock");
    expect(dlg).toContain("dealerSignalsReportTranslate(sessionId)");
  });
});
