/**
 * «Izsoļu arhīvs dīlera datu vietā» - klienta ziņas (makets 2. solis, rāmis variants A).
 * - Piedāvājums: PĀRDOD izsoļu arhīvu - divas opcijas (pogas ved uz izvēles lapu ar «Apstiprināt»),
 *   2 serverī izplūdinātas bildes (https saites, nekādu data: URI), rezerve - atbilde «1» / «2».
 * - Gatavs: PDF pielikumā pēc klienta «Jā».
 * Tīrs modulis (bez servera atkarībām) - testējams un lietojams sūtīšanas logā.
 */
import {
  auctionArchiveCountries,
  auctionArchiveMaxKm,
  auctionArchivePlatforms,
  auctionArchiveYears,
  formatEurCents,
  formatIsoDayLv,
  lvCount,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import {
  EMAIL_COLORS as C,
  EMAIL_FONT as F,
  emailAttachmentsRow,
  emailButton,
  emailDocument,
  emailFactsRow,
  emailIconImg,
  emailParagraph,
  emailRow,
  emailSmall,
  emailSpacer,
  emailStatusCardRow,
  escHtml,
  formatEmailDate,
  escMultiline,
  formatEmailFileSize,
} from "@/lib/email/email-layout";

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

export type AuctionArchiveEmailFacts = {
  auctions: number;
  photos: number;
  /** «2026» vai «2024-2026». */
  years: string;
  countries: string;
  platforms: string;
  lastDate: string;
  maxKm: string;
  pricedAuctions: number;
};

export function auctionArchiveEmailFacts(s: AuctionArchiveSummary): AuctionArchiveEmailFacts {
  const years = auctionArchiveYears(s);
  const last = [...s.auctions].reverse().find((a) => a.date)?.date ?? "";
  return {
    auctions: s.auctions.length,
    photos: s.photoCount,
    years: years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : (years[0] ?? ""),
    countries: auctionArchiveCountries(s).join(", "),
    platforms: auctionArchivePlatforms(s).join(", "),
    lastDate: formatIsoDayLv(last),
    maxKm: (() => {
      const km = auctionArchiveMaxKm(s);
      return km == null ? "" : `${String(km).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
    })(),
    pricedAuctions: s.auctions.filter((a) => a.priceEur != null).length,
  };
}

/* ---------- Piedāvājums ---------- */

export function auctionArchiveOfferSubject(s: AuctionArchiveSummary): string {
  const car = [s.title, s.vin].filter(Boolean).join(" · ");
  return `Dīlera datu nav - piedāvājam izsoļu arhīvu ar bildēm${car ? ` (${car})` : ""}`.slice(0, 180);
}

/** Rediģējamais teksts (e-pasts): makets 1. solis. */
export function auctionArchiveOfferText(s: AuctionArchiveSummary, paidCents: number | null): string {
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(paidCents);
  const where = [f.lastDate, f.countries].filter(Boolean).join(", ");
  const what = f.photos > 0 ? `ar ${f.photos} oriģinālajām izsoles bildēm, cenām un nobraukumu` : "ar cenām un nobraukumu";
  return [
    "Labdien!",
    "",
    `Pārbaudījām auto VIN ${s.vin}. Oficiālā dīlera servisa vēsture šim auto nav pieejama.`,
    "",
    `Taču atradām to Eiropas izsoļu arhīvā: ${lvCount(f.auctions || 1, "izsole", "izsoles")}${where ? ` (${where})` : ""} ${what}.`,
    "",
    "Varat izvēlēties:",
    "1 - nomainīt dīlera datus uz izsoļu arhīvu (bez piemaksas)",
    `2 - atgriezt ${refund || "samaksāto summu"} uz karti`,
    "",
    "Kamēr neizvēlaties, neko nesūtām.",
    "",
    "Ar cieņu,",
    "Nils Valainis",
    "PROVIN.LV",
  ].join("\n");
}

/** WhatsApp teksts: makets 2. solis (atbilde «1» vai «2», Nils atzīmē adminā). */
export function auctionArchiveOfferWhatsappText(s: AuctionArchiveSummary, paidCents: number | null): string {
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(paidCents);
  const car = s.title ? `Jūsu ${s.title} (VIN ${s.vin})` : `auto VIN ${s.vin}`;
  const meta = [f.years ? `${f.years}. gadā` : "", f.countries ? `(${f.countries})` : ""].filter(Boolean).join(" ");
  const parts = [
    lvCount(f.auctions || 1, "izsole", "izsoles") + (meta ? ` ${meta}` : ""),
    f.photos > 0 ? `${f.photos} oriģinālās bildes` : "",
    "cenas, nobraukums un bojājumi pa zonām",
  ].filter(Boolean);
  return [
    `Labdien! Pārbaudījām ${car} - oficiālā dīlera vēstures šim auto nav.`,
    `Bet atradām to Eiropas izsoļu arhīvā: ${parts.join(", ")}.`,
    "Ko izvēlaties?",
    "1 - nomainīt uz izsoļu arhīvu (bez piemaksas)",
    `2 - atgriezt ${refund || "samaksāto summu"}`,
    "Atbildiet ar 1 vai 2. Kamēr neizvēlaties, neko nesūtām.",
    "Nils, PROVIN.LV",
  ].join("\n");
}

function previewRow(previews: readonly { url: string; caption: string }[]): string {
  const list = previews.filter((p) => /^https:\/\//.test(p.url)).slice(0, 2);
  if (list.length === 0) return "";
  const w = list.length === 1 ? 100 : 50;
  const cells = list
    .map(
      (p, i) =>
        `<td width="${w}%" valign="top" style="padding:${i ? "0 0 0 6px" : list.length > 1 ? "0 6px 0 0" : "0"};"><img src="${escHtml(p.url)}" width="${list.length === 1 ? 528 : 261}" alt="${escHtml(p.caption)}" style="display:block;width:100%;height:auto;border:0;border-radius:10px;"/>${
          p.caption ? `<p class="c-mut" style="margin:6px 0 0;font-family:${F};font-size:12px;line-height:16px;color:${C.mut};">${escHtml(p.caption)}</p>` : ""
        }</td>`,
    )
    .join("");
  return `<tr><td class="m-pad" style="padding:16px 36px 0;"><table ${TABLE} width="100%"><tr>${cells}</tr></table></td></tr>`;
}

function contentsRow(s: AuctionArchiveSummary): string {
  const f = auctionArchiveEmailFacts(s);
  const items = [
    { t: "Visas izsoles bildes", sub: f.photos > 0 ? `${f.photos}, ar datumiem` : "ar datumiem" },
    { t: "Izsoles cenas", sub: f.pricedAuctions > 0 ? lvCount(f.pricedAuctions, "izsolē", "izsolēs") : "ja izsole tās norāda" },
    { t: "Nobraukums izsoles dienā", sub: "ar odometra bildi, ja tāda ir" },
    { t: "Bojājumi pa zonām", sub: "uz virsbūves shēmas" },
    { t: "Izsoles apraksts", sub: "oriģināls + tulkojums" },
  ];
  const rows = items
    .map(
      (it) =>
        `<tr><td width="28" valign="top" style="padding:0 0 10px;">${emailIconImg("check", 18)}</td><td valign="top" style="padding:0 0 10px 6px;font-family:${F};"><span class="c-ink" style="font-size:14px;line-height:20px;font-weight:600;color:${C.ink};">${escHtml(it.t)}</span> <span class="c-mut" style="font-size:13px;line-height:20px;color:${C.mut};">${escHtml(it.sub)}</span></td></tr>`,
    )
    .join("");
  return `<tr><td class="m-pad" style="padding:18px 36px 0;"><table ${TABLE} width="100%">${rows}</table></td></tr>`;
}

export type AuctionArchiveOfferEmailInput = {
  summary: AuctionArchiveSummary;
  paidCents: number | null;
  /** Admina rediģētais teksts (rindkopas ar tukšu rindu). */
  text: string;
  /** Izvēles lapa `https://www.provin.lv/lv/izvele/<token>`. */
  choiceUrl: string;
  previews: readonly { url: string; caption: string }[];
  date?: Date;
};

/** Saite ar izvēli iepriekš atzīmētu (lapā vēl jāspiež «Apstiprināt»). */
export function auctionArchiveChoiceHref(choiceUrl: string, v: "archive" | "refund"): string {
  return `${choiceUrl}${choiceUrl.includes("?") ? "&" : "?"}v=${v}`;
}

export function auctionArchiveOfferEmailHtml(o: AuctionArchiveOfferEmailInput): string {
  const s = o.summary;
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(o.paidCents);
  const paragraphs = o.text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => emailParagraph(escMultiline(b), "margin:0 0 14px;"))
    .join("");
  const facts = emailFactsRow(
    [
      { value: lvCount(f.auctions || 1, "izsole", "izsoles"), label: f.years || "izsoļu arhīvs" },
      f.photos > 0 ? { value: String(f.photos), label: "izsoles bildes" } : null,
      f.countries || f.platforms ? { value: f.countries || f.platforms, label: f.countries ? f.platforms : "izsoles" } : null,
    ].filter((x): x is { value: string; label: string } => x != null),
  );
  const buttons = `<tr><td class="m-pad" style="padding:22px 36px 0;">${emailParagraph("<strong>Izvēlieties, kā turpināt:</strong>", "margin:0 0 12px;")}${emailButton(
    auctionArchiveChoiceHref(o.choiceUrl, "archive"),
    "Jā, nomainīt uz izsoļu arhīvu",
  )}${emailSpacer(10)}${emailButton(
    auctionArchiveChoiceHref(o.choiceUrl, "refund"),
    escHtml(refund ? `Atgriezt ${refund}` : "Atgriezt naudu").replace(/ €/g, "&nbsp;€"),
    "ghost",
  )}${emailSpacer(12)}${emailSmall(
    "Maiņa bez piemaksas, PDF saņemsiet 24 stundu laikā. Vai vienkārši atbildiet uz šo e-pastu ar «1» (arhīvs) vai «2» (atmaksa). Kamēr neizvēlaties, neko nesūtām.",
  )}</td></tr>`;
  const rows = [
    emailStatusCardRow({
      icon: "gavel",
      eyebrow: "Oficiālā dīlera dati",
      title: "Dīlera datu nav - bet atradām izsoļu vēsturi ar bildēm",
      car: s.title || null,
      vin: s.vin || null,
      date: formatEmailDate(o.date ?? new Date()),
    }),
    paragraphs ? emailRow(paragraphs, "22px 36px 0") : "",
    facts,
    previewRow(o.previews),
    contentsRow(s),
    buttons,
  ].join("\n");
  return emailDocument({ rows, lang: "lv", preheader: `${lvCount(f.auctions || 1, "izsole", "izsoles")}, ${f.photos} bildes - izvēlieties arhīvu vai atmaksu` });
}

/** Teksta daļa (multipart): admina teksts + izvēles saite. */
export function auctionArchiveOfferPlainText(text: string, choiceUrl: string): string {
  return `${text.trim()}\n\nIzvēlēties un apstiprināt: ${choiceUrl}`;
}

/* ---------- Gatavs (PDF pēc klienta «Jā») ---------- */

export function auctionArchiveReadySubject(s: AuctionArchiveSummary): string {
  const car = [s.title, s.vin].filter(Boolean).join(" · ");
  return `Izsoļu arhīvs${car ? ` - ${car}` : ""}`.slice(0, 180);
}

export function auctionArchiveReadyText(s: AuctionArchiveSummary): string {
  const f = auctionArchiveEmailFacts(s);
  const what = [lvCount(f.auctions || 1, "izsole", "izsoles"), f.photos > 0 ? lvCount(f.photos, "bilde", "bildes") : ""].filter(Boolean).join(", ");
  return [
    "Labdien!",
    "",
    `Paldies par izvēli. Pielikumā izsoļu arhīvs auto VIN ${s.vin} (${what}) - bildes ar datumiem, cenas, nobraukums, bojājumi pa zonām un izsoles apraksts.`,
    "",
    "Piemaksa nav jāveic.",
    "",
    "Ar cieņu,",
    "Nils Valainis",
    "PROVIN.LV",
  ].join("\n");
}

export function auctionArchiveReadyWhatsappText(s: AuctionArchiveSummary): string {
  return `Labdien! Paldies par izvēli - nosūtu izsoļu arhīvu auto VIN ${s.vin} (PDF). Piemaksa nav jāveic.\nNils, PROVIN.LV`;
}

export function auctionArchiveReadyEmailHtml(o: {
  summary: AuctionArchiveSummary;
  text: string;
  attachment: { filename: string; bytes: number };
  date?: Date;
}): string {
  const paragraphs = o.text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => emailParagraph(escMultiline(b), "margin:0 0 14px;"))
    .join("");
  const rows = [
    emailStatusCardRow({
      icon: "check",
      eyebrow: "Izsoļu arhīvs",
      title: "Izsoļu arhīvs gatavs",
      car: o.summary.title || null,
      vin: o.summary.vin || null,
      date: formatEmailDate(o.date ?? new Date()),
    }),
    paragraphs ? emailRow(paragraphs, "22px 36px 0") : "",
    emailAttachmentsRow([{ name: o.attachment.filename, meta: ["PDF", formatEmailFileSize(o.attachment.bytes)].filter(Boolean).join(" · ") }]),
  ].join("\n");
  return emailDocument({ rows, lang: "lv", preheader: "Izsoļu arhīvs pielikumā" });
}
