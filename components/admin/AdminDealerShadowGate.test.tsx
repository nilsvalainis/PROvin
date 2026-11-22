import { describe, expect, it } from "vitest";
import {
  AdminDealerShadowFeedback,
  AdminDealerShadowGateRow,
  dealerShadowReasons,
} from "@/components/admin/AdminDealerShadowGate";
import { MobileDealerOrderPanelView } from "@/components/admin/mobile/MobileDealerOrderPanel";
import {
  adminIngestFromDealerJob,
  adminIngestShadowLabel,
  parseAdminOrderIngest,
} from "@/lib/admin-mobile-ingest";
import type { DealerShadowGate } from "@/lib/dealer-shadow-types";
import { renderHtml, renderText } from "@/lib/test-render";

const noop = () => undefined;

const HOLD: DealerShadowGate = {
  verdict: "would_hold",
  at: "2026-11-22T10:00:00.000Z",
  version: 1,
  checks: [
    { id: "job_status", title: "Ielases statuss", state: "ok", severity: "block", reason: "" },
    {
      id: "raw_dates",
      title: "Datumi un km atbilst RAW",
      state: "fail",
      severity: "block",
      reason: "RAW vizīte 09.11.2022 · 140 740 km tabulā pielikta pie 11.11.2025",
      place: "service_table",
    },
    { id: "pdf", title: "PDF gatavs, VIN sakrīt", state: "fail", severity: "warn", reason: "PDF vēl nav", place: "pdf" },
    {
      id: "oil_facts",
      title: "Eļļas maiņu skaitļi sakrīt ar kodu",
      state: "fail",
      severity: "block",
      reason: "Tekstā 13 eļļas maiņas, kods - 6",
      place: "oil_notes",
    },
  ],
};
const SEND: DealerShadowGate = {
  verdict: "would_send",
  at: "2026-11-22T10:00:00.000Z",
  version: 1,
  checks: [{ id: "pdf", title: "PDF gatavs, VIN sakrīt", state: "fail", severity: "warn", reason: "PDF vēl nav", place: "pdf" }],
};

describe("AdminDealerShadowGateRow", () => {
  it("aizturētu: dzeltens punkts, «N iemesli», saraksts ar saiti uz vietu (bloķējošie vispirms)", () => {
    const html = renderHtml(<AdminDealerShadowGateRow gate={HOLD} onRecheck={noop} defaultOpen />);
    expect(html).toContain('data-dealer-shadow="hold"');
    expect(html).toContain("bg-amber-500");
    const text = renderText(<AdminDealerShadowGateRow gate={HOLD} onRecheck={noop} defaultOpen />);
    expect(text).toContain("Sistēma aizturētu · 2 iemesli");
    expect(text).toContain("Pārbaudīt vēlreiz");
    expect(text).toContain("Servisa tabula");
    expect(text.indexOf("Datumi un km")).toBeLessThan(text.indexOf("PDF gatavs"));
    expect(dealerShadowReasons(HOLD).map((c) => c.id)).toEqual(["raw_dates", "oil_facts", "pdf"]);
  });

  it("sūtītu: zaļš punkts; brīdinājumi kā piezīmes; telefona stikla variants", () => {
    const text = renderText(<AdminDealerShadowGateRow gate={SEND} />);
    expect(text).toContain("Sistēma sūtītu");
    expect(text).toContain("1 piezīmes");
    expect(renderHtml(<AdminDealerShadowGateRow gate={SEND} />)).toContain("bg-emerald-500");
    const glass = renderHtml(<AdminDealerShadowGateRow glass gate={HOLD} onRecheck={noop} />);
    expect(glass).toContain("amx-st--warn");
    expect(renderHtml(<AdminDealerShadowGateRow glass gate={SEND} />)).toContain("amx-st--ok");
  });

  it("bez sprieduma: «Pārbaude nav palaista»", () => {
    expect(renderText(<AdminDealerShadowGateRow gate={null} onRecheck={noop} />)).toContain("Pārbaude nav palaista");
  });
});

describe("AdminDealerShadowFeedback (sūtīšanas forma)", () => {
  it("spriedums + divas pogas + atgādinājums (neobligāti)", () => {
    const text = renderText(<AdminDealerShadowFeedback gate={HOLD} feedback={null} onSubmit={noop} />);
    expect(text).toContain("Sistēma aizturētu · 2 iemesli");
    expect(text).toContain("Pārbaude pareiza");
    expect(text).toContain("Pārbaude kļūdījās");
    expect(text).toContain("Atzīmē, vai pārbaude bija pareiza (neobligāti).");
    expect(text).toContain("Datumi un km atbilst RAW");
  });

  it("atbildēts: rāda atzīmi, atgādinājuma nav", () => {
    const text = renderText(
      <AdminDealerShadowFeedback gate={SEND} feedback={{ correct: false, note: "datums nepareizs", at: "t" }} onSubmit={noop} />,
    );
    expect(text).toContain("Atzīmēts: pārbaude kļūdījās - datums nepareizs");
    expect(text).not.toContain("Atzīmē, vai");
  });

  it("bez sprieduma - nekas netiek rādīts", () => {
    expect(renderHtml(<AdminDealerShadowFeedback gate={null} feedback={null} onSubmit={noop} />)).toBe("");
  });
});

describe("saraksta indikators un telefona B1", () => {
  it("adminIngestFromDealerJob pieliek ēnu spriedumu; RSC parsēšana to saglabā", () => {
    const hold = adminIngestFromDealerJob({ status: "done", serviceEventCount: 4, shadowGate: HOLD }, false);
    expect(hold).toMatchObject({ shadow: "hold", shadowReasons: 2 });
    expect(adminIngestShadowLabel(hold)).toBe("Sistēma aizturētu · 2");
    expect(parseAdminOrderIngest(JSON.parse(JSON.stringify(hold)))).toMatchObject({ shadow: "hold", shadowReasons: 2 });
    const send = adminIngestFromDealerJob({ status: "done", serviceEventCount: 4, shadowGate: SEND }, true);
    expect(adminIngestShadowLabel(send)).toBe("Sistēma sūtītu");
    expect(adminIngestShadowLabel(adminIngestFromDealerJob({ status: "done", serviceEventCount: 4 }))).toBeNull();
  });

  it("B1 statusa kartītē rinda «Sistēma aizturētu» (glass), esošās pogas paliek", () => {
    const text = renderText(
      <MobileDealerOrderPanelView
        ingest={adminIngestFromDealerJob({ status: "done", serviceEventCount: 4, shadowGate: HOLD }, false)}
        statusSub=""
        sentLabel="Nav nosūtīts"
        records={[]}
        aiFields={[]}
        busy={null}
        pdfDisabled={false}
        sendDisabled={false}
        refundEnabled={false}
        refundLabel="Atmaksa"
        rerunEnabled
        rerunLabel="Ielasīt vēlreiz"
        notice={null}
        onPdf={noop}
        onSend={noop}
        onRefund={noop}
        onRerun={noop}
        onShowAllRecords={noop}
        onEditAi={noop}
        shadowGate={HOLD}
        onShadowRecheck={noop}
      />,
    );
    expect(text).toContain("Sistēma aizturētu · 2 iemesli");
    for (const b of ["Pārbaudīt PDF", "Sūtīt klientam", "Atmaksa", "Ielasīt vēlreiz"]) expect(text).toContain(b);
  });
});
