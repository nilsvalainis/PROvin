import { describe, expect, it } from "vitest";

import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import {
  COMMENT_SNAPSHOT_MAX_ENTRIES,
  appendCommentSnapshot,
  buildClientReportCommentSnapshot,
  collectAiCommentFinalTexts,
  scrubCommentSnapshotText,
} from "@/lib/client-report-comment-snapshot-core";

function draft(): OrderDraftState {
  return {
    updatedAt: "2026-11-19T10:00:00.000Z",
    orderEdits: {
      customerEmail: "klients@example.com",
      customerName: "Jānis Bērziņš",
      customerPhone: "+371 29 123 456",
      mileageComment: "<p>Nobraukums konsekvents.</p>",
      internalComment: "Negadījumu nav.",
      sourcesComparisonComment: "",
    },
    workspace: {
      sourceBlocks: {
        autodna: { comments: "<p>AutoDNA: 2 rādījumi.</p>", rows: [] },
        auto_records: { comments: "", serviceHistoryNotes: "Apkopes regulāras.", oilChangeIntervalNotes: "" },
        citi_avoti: { sections: [{ comments: "Car-Pass: ok" }, { comments: "" }] },
        listing_analysis: {
          sellerPortrait: "Dīleris Vācijā.",
          photoAnalysis: "",
          listingSalesContext: "",
          extraSellerName: "Privātpersona X",
          listingPasteRaw: "Zvanīt 29123456",
          aiContextRaw: "slepens",
        },
      },
      iriss: "<p>Kopsavilkums: <b>pirkt</b>.</p>",
      apskatesPlāns: "Pārbaudīt bremzes.",
      tehniskoRiskuAnalize: "Ķēde N47 - riska zona.",
      cenasAtbilstiba: "",
      previewConfirmed: true,
    },
  };
}

describe("collectAiCommentFinalTexts", () => {
  it("savāc visus AI komentāru laukus kā plain tekstu, tukšos izlaiž", () => {
    const f = collectAiCommentFinalTexts(draft());
    expect(f).toEqual({
      technical_risks: "Ķēde N47 - riska zona.",
      inspection: "Pārbaudīt bremzes.",
      summary: "Kopsavilkums: pirkt.",
      mileage: "Nobraukums konsekvents.",
      incidents: "Negadījumu nav.",
      seller: "Dīleris Vācijā.",
      "source:autodna": "AutoDNA: 2 rādījumi.",
      "source:auto_records:serviceHistoryNotes": "Apkopes regulāras.",
      "source:citi_avoti:0": "Car-Pass: ok",
    });
  });

  it("nesatur klienta e-pastu, vārdu, tālruni un iekopēto sludinājumu", () => {
    const json = JSON.stringify(
      buildClientReportCommentSnapshot({ draft: draft(), sentAt: "t", lang: "lv", corrected: false, version: 2 }),
    );
    expect(json).not.toContain("klients@example.com");
    expect(json).not.toContain("Bērziņš");
    expect(json).not.toContain("29123456");
    expect(json).not.toContain("Privātpersona");
    expect(json).not.toContain("slepens");
  });

  it("e-pastus un tālruņus komentārā aizvieto", () => {
    expect(scrubCommentSnapshotText("Rakstiet a.b@c.lv vai +371 29 123 456")).toBe("Rakstiet [e-pasts] vai [tālrunis]");
    expect(scrubCommentSnapshotText("Nobraukums 201 234 km 2019. gadā")).toBe("Nobraukums 201 234 km 2019. gadā");
  });

  it("bez melnraksta - tukšs", () => {
    expect(collectAiCommentFinalTexts(null)).toEqual({});
  });
});

describe("buildClientReportCommentSnapshot / appendCommentSnapshot", () => {
  it("versija, laiks un «labota» atzīme", () => {
    const s = buildClientReportCommentSnapshot({
      draft: draft(),
      sentAt: "2026-11-19T12:00:00.000Z",
      lang: "lv",
      corrected: true,
      version: 3,
    });
    expect(s.version).toBe(3);
    expect(s.corrected).toBe(true);
    expect(s.sentAt).toBe("2026-11-19T12:00:00.000Z");
    expect(Object.keys(s.fields).length).toBeGreaterThan(0);
    const noVersion = buildClientReportCommentSnapshot({ draft: draft(), sentAt: "t", lang: "en", corrected: false });
    expect("version" in noVersion).toBe(false);
  });

  it("glabā ne vairāk par limitu, jaunākos", () => {
    let list: ReturnType<typeof appendCommentSnapshot> = [];
    for (let i = 1; i <= COMMENT_SNAPSHOT_MAX_ENTRIES + 3; i++) {
      list = appendCommentSnapshot(list, { version: i, sentAt: String(i), corrected: i > 1, lang: "lv", fields: {} });
    }
    expect(list).toHaveLength(COMMENT_SNAPSHOT_MAX_ENTRIES);
    expect(list[list.length - 1]!.version).toBe(COMMENT_SNAPSHOT_MAX_ENTRIES + 3);
  });
});
