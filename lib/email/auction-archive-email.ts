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
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  AUCTION_ARCHIVE_EMAIL_I18N,
  auctionArchiveCountryInLang,
  auctionArchiveForeignLang,
  type AuctionArchiveEmailCopy,
  type AuctionArchiveForeignLang,
} from "@/lib/email/auction-archive-email-i18n";

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

/* ---------- Klienta valoda (Nils 26.11) ---------- */

type Foreign = { l: AuctionArchiveForeignLang; c: AuctionArchiveEmailCopy };

function foreign(lang: ClientReportLang | null | undefined): Foreign | null {
  const l = auctionArchiveForeignLang(lang);
  return l ? { l, c: AUCTION_ARCHIVE_EMAIL_I18N[l] } : null;
}

function foreignCountries(s: AuctionArchiveSummary, l: AuctionArchiveForeignLang): string {
  return auctionArchiveCountries(s)
    .map((x) => auctionArchiveCountryInLang(x, l))
    .join(", ");
}

function foreignWhere(s: AuctionArchiveSummary, f: AuctionArchiveEmailFacts, l: AuctionArchiveForeignLang): string {
  return [f.lastDate, foreignCountries(s, l)].filter(Boolean).join(", ");
}

function foreignSign(c: AuctionArchiveEmailCopy): string[] {
  return [c.regards, "Nils Valainis", "PROVIN.LV"];
}

/* ---------- Piedāvājums ---------- */

/** Vērtības teikums (Nils 23.11): bildēs redzams stāvoklis pirms ievešanas Latvijā. */
export const AUCTION_ARCHIVE_VALUE_SENTENCE =
  "Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā - skrāpējumi, iespējamie bojājumi un citas detaļas, ko pēc remonta vai sakopšanas vairs neredz.";

/** «ar 84 oriģinālajām izsoles bildēm[, cenām] un nobraukumu» - cenas tikai ar «Rādīt izsoļu cenas». */
function archiveWhat(photos: number, showPrices: boolean): string {
  const tail = showPrices ? "cenām un nobraukumu" : "nobraukumu";
  return photos > 0 ? `ar ${photos} oriģinālajām izsoles bildēm${showPrices ? ", " : " un "}${tail}` : `ar ${tail}`;
}

export function auctionArchiveOfferSubject(s: AuctionArchiveSummary, lang?: ClientReportLang | null): string {
  const car = [s.title, s.vin].filter(Boolean).join(" · ");
  const fl = foreign(lang);
  if (fl) return fl.c.offerSubject(car).slice(0, 180);
  return `Dīlera datu nav - piedāvājam izsoļu arhīvu ar bildēm${car ? ` (${car})` : ""}`.slice(0, 180);
}

/** Rediģējamais teksts (e-pasts): makets 1. solis. */
export function auctionArchiveOfferText(
  s: AuctionArchiveSummary,
  paidCents: number | null,
  showPrices = false,
  lang?: ClientReportLang | null,
): string {
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(paidCents);
  const fl = foreign(lang);
  if (fl) {
    const { l, c } = fl;
    return [
      c.hello,
      "",
      c.offerChecked(s.vin),
      "",
      `${c.offerFound(c.auctions(f.auctions || 1), foreignWhere(s, f, l), c.what(f.photos, showPrices))}${f.photos > 0 ? ` ${c.value}` : ""}`,
      "",
      c.choose,
      c.option1,
      c.option2(refund || c.refundFallback),
      "",
      c.untilChoose,
      "",
      ...foreignSign(c),
    ].join("\n");
  }
  const where = [f.lastDate, f.countries].filter(Boolean).join(", ");
  const what = archiveWhat(f.photos, showPrices);
  return [
    "Labdien!",
    "",
    `Pārbaudījām auto VIN ${s.vin}. Oficiālā dīlera servisa vēsture šim auto nav pieejama.`,
    "",
    `Taču atradām to Eiropas izsoļu arhīvā: ${lvCount(f.auctions || 1, "izsole", "izsoles")}${where ? ` (${where})` : ""} ${what}.${
      f.photos > 0 ? ` ${AUCTION_ARCHIVE_VALUE_SENTENCE}` : ""
    }`,
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
export function auctionArchiveOfferWhatsappText(
  s: AuctionArchiveSummary,
  paidCents: number | null,
  showPrices = false,
  lang?: ClientReportLang | null,
): string {
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(paidCents);
  const fl = foreign(lang);
  if (fl) {
    const { l, c } = fl;
    const countries = foreignCountries(s, l);
    const meta = [f.years ? c.waYears(f.years) : "", countries ? `(${countries})` : ""].filter(Boolean).join(" ");
    const parts = [c.auctions(f.auctions || 1) + (meta ? ` ${meta}` : ""), f.photos > 0 ? c.waPhotos(f.photos) : "", c.waTail(showPrices)].filter(Boolean);
    return [
      c.waOffer(c.waCar(s.title, s.vin), parts.join(", ")),
      ...(f.photos > 0 ? [c.value] : []),
      c.waChoose,
      c.waOption1,
      c.waOption2(refund || c.refundFallback),
      c.waReply,
      "Nils, PROVIN.LV",
    ].join("\n");
  }
  const car = s.title ? `Jūsu ${s.title} (VIN ${s.vin})` : `auto VIN ${s.vin}`;
  const meta = [f.years ? `${f.years}. gadā` : "", f.countries ? `(${f.countries})` : ""].filter(Boolean).join(" ");
  const parts = [
    lvCount(f.auctions || 1, "izsole", "izsoles") + (meta ? ` ${meta}` : ""),
    f.photos > 0 ? `${f.photos} oriģinālās bildes` : "",
    showPrices ? "cenas, nobraukums un bojājumi pa zonām" : "nobraukums un bojājumi pa zonām",
  ].filter(Boolean);
  return [
    `Labdien! Pārbaudījām ${car} - oficiālā dīlera vēstures šim auto nav.`,
    `Bet atradām to Eiropas izsoļu arhīvā: ${parts.join(", ")}.`,
    ...(f.photos > 0 ? [AUCTION_ARCHIVE_VALUE_SENTENCE] : []),
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

function contentsRow(s: AuctionArchiveSummary, showPrices: boolean, lang?: ClientReportLang | null): string {
  const f = auctionArchiveEmailFacts(s);
  const fl = foreign(lang);
  const k = fl?.c.html.contents;
  const items = k
    ? [
        { t: k.photos, sub: f.photos > 0 ? k.photosSub(f.photos) : k.photosSubNone },
        ...(showPrices ? [{ t: k.prices, sub: f.pricedAuctions > 0 ? k.pricesSub(f.pricedAuctions) : k.pricesSubNone }] : []),
        { t: k.km, sub: k.kmSub },
        { t: k.damage, sub: k.damageSub },
        { t: k.description, sub: k.descriptionSub },
      ]
    : [
        { t: "Visas izsoles bildes", sub: f.photos > 0 ? `${f.photos}, ar datumiem - stāvoklis pirms ievešanas Latvijā` : "ar datumiem" },
        ...(showPrices
          ? [{ t: "Izsoles cenas", sub: f.pricedAuctions > 0 ? lvCount(f.pricedAuctions, "izsolē", "izsolēs") : "ja izsole tās norāda" }]
          : []),
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
  /** «Rādīt izsoļu cenas» - citādi cenas e-pastā neparādās. */
  showPrices?: boolean;
  /** 3 dienu atgādinājums klientam (tās pašas 2 pogas). */
  reminder?: boolean;
  date?: Date;
  /** Klienta valoda (piedāvājuma `locale`); noklusēti LV. */
  lang?: ClientReportLang | null;
};

/** Saite ar izvēli iepriekš atzīmētu (lapā vēl jāspiež «Apstiprināt»). */
export function auctionArchiveChoiceHref(choiceUrl: string, v: "archive" | "refund"): string {
  return `${choiceUrl}${choiceUrl.includes("?") ? "&" : "?"}v=${v}`;
}

export function auctionArchiveOfferEmailHtml(o: AuctionArchiveOfferEmailInput): string {
  const s = o.summary;
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(o.paidCents);
  const fl = foreign(o.lang);
  const h = fl?.c.html;
  const auctionsLabel = fl ? fl.c.auctions(f.auctions || 1) : lvCount(f.auctions || 1, "izsole", "izsoles");
  const countries = fl ? foreignCountries(s, fl.l) : f.countries;
  const paragraphs = o.text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => emailParagraph(escMultiline(b), "margin:0 0 14px;"))
    .join("");
  const facts = emailFactsRow(
    [
      { value: auctionsLabel, label: f.years || (h ? h.archive : "izsoļu arhīvs") },
      f.photos > 0 ? { value: String(f.photos), label: h ? h.photosLabel : "izsoles bildes" } : null,
      countries || f.platforms ? { value: countries || f.platforms, label: countries ? f.platforms : h ? h.auctionsLabel : "izsoles" } : null,
    ].filter((x): x is { value: string; label: string } => x != null),
  );
  const refundLabel = refund ? (h ? h.btnRefund(refund) : `Atgriezt ${refund}`) : h ? h.btnRefundFallback : "Atgriezt naudu";
  const buttons = `<tr><td class="m-pad" style="padding:22px 36px 0;">${emailParagraph(
    `<strong>${escHtml(h ? h.chooseHow : "Izvēlieties, kā turpināt:")}</strong>`,
    "margin:0 0 12px;",
  )}${emailButton(auctionArchiveChoiceHref(o.choiceUrl, "archive"), escHtml(h ? h.btnArchive : "Jā, nomainīt uz izsoļu arhīvu"))}${emailSpacer(10)}${emailButton(
    auctionArchiveChoiceHref(o.choiceUrl, "refund"),
    escHtml(refundLabel).replace(/ €/g, "&nbsp;€"),
    "ghost",
  )}${emailSpacer(12)}${emailSmall(
    h
      ? escHtml(h.small)
      : "Maiņa bez piemaksas, PDF saņemsiet 24 stundu laikā. Vai vienkārši atbildiet uz šo e-pastu ar «1» (arhīvs) vai «2» (atmaksa). Kamēr neizvēlaties, neko nesūtām.",
  )}</td></tr>`;
  const rows = [
    emailStatusCardRow({
      icon: "gavel",
      eyebrow: o.reminder ? (h ? h.eyebrowReminder : "Atgādinājums") : h ? h.eyebrowOffer : "Oficiālā dīlera dati",
      title: o.reminder
        ? h
          ? h.titleReminder
          : "Gaidām Jūsu izvēli - izsoļu arhīvs vai atmaksa"
        : h
          ? h.titleOffer
          : "Dīlera datu nav - bet atradām izsoļu vēsturi ar bildēm",
      car: s.title || null,
      vin: s.vin || null,
      date: formatEmailDate(o.date ?? new Date()),
    }),
    paragraphs ? emailRow(paragraphs, "22px 36px 0") : "",
    facts,
    previewRow(o.previews),
    contentsRow(s, o.showPrices === true, o.lang),
    buttons,
  ].join("\n");
  return emailDocument({
    rows,
    lang: fl ? fl.l : "lv",
    preheader: h ? h.preheaderOffer(auctionsLabel, f.photos) : `${auctionsLabel}, ${f.photos} bildes - izvēlieties arhīvu vai atmaksu`,
  });
}

/** Teksta daļa (multipart): admina teksts + izvēles saite. */
export function auctionArchiveOfferPlainText(text: string, choiceUrl: string, lang?: ClientReportLang | null): string {
  const fl = foreign(lang);
  return `${text.trim()}\n\n${fl ? fl.c.plainChoose : "Izvēlēties un apstiprināt:"} ${choiceUrl}`;
}

/* ---------- Atgādinājums klientam (3 dienas bez izvēles, vienreiz) ---------- */

export function auctionArchiveReminderSubject(s: AuctionArchiveSummary, lang?: ClientReportLang | null): string {
  const car = [s.title, s.vin].filter(Boolean).join(" · ");
  const fl = foreign(lang);
  if (fl) return fl.c.reminderSubject(car).slice(0, 180);
  return `Atgādinājums: izsoļu arhīvs vai atmaksa${car ? ` (${car})` : ""}`.slice(0, 180);
}

export function auctionArchiveReminderText(
  s: AuctionArchiveSummary,
  paidCents: number | null,
  showPrices = false,
  lang?: ClientReportLang | null,
): string {
  const f = auctionArchiveEmailFacts(s);
  const refund = formatEurCents(paidCents);
  const fl = foreign(lang);
  if (fl) {
    const { l, c } = fl;
    return [
      c.hello,
      "",
      `${c.reminderLead(s.vin, c.auctions(f.auctions || 1), foreignWhere(s, f, l), c.what(f.photos, showPrices))}${f.photos > 0 ? ` ${c.value}` : ""}`,
      "",
      c.chooseReminder,
      c.option1,
      c.option2(refund || c.refundFallback),
      "",
      c.untilChoose,
      "",
      ...foreignSign(c),
    ].join("\n");
  }
  const where = [f.lastDate, f.countries].filter(Boolean).join(", ");
  return [
    "Labdien!",
    "",
    `Atgādinām par auto VIN ${s.vin}: oficiālā dīlera servisa vēsture nav pieejama, taču atradām to Eiropas izsoļu arhīvā - ${lvCount(f.auctions || 1, "izsole", "izsoles")}${where ? ` (${where})` : ""} ${archiveWhat(f.photos, showPrices)}.${
      f.photos > 0 ? ` ${AUCTION_ARCHIVE_VALUE_SENTENCE}` : ""
    }`,
    "",
    "Lūdzu, izvēlieties:",
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

/** WhatsApp atgādinājums - Nilam kopēšanai (pats nosūta). */
export function auctionArchiveReminderWhatsappText(
  s: AuctionArchiveSummary,
  paidCents: number | null,
  choiceUrl: string,
  lang?: ClientReportLang | null,
): string {
  const refund = formatEurCents(paidCents);
  const fl = foreign(lang);
  if (fl) {
    return [fl.c.waReminder(s.vin, refund || fl.c.refundFallback), fl.c.waReminderChoose, choiceUrl, "Nils, PROVIN.LV"].join("\n");
  }
  return [
    `Labdien! Atgādinu par auto VIN ${s.vin} - izsoļu arhīvs ar bildēm (bez piemaksas) vai atmaksa ${refund || "samaksātās summas"}?`,
    "Atbildiet ar 1 (arhīvs) vai 2 (atmaksa), vai izvēlieties šeit:",
    choiceUrl,
    "Nils, PROVIN.LV",
  ].join("\n");
}

/* ---------- Gatavs (PDF pēc klienta «Jā») ---------- */

export function auctionArchiveReadySubject(s: AuctionArchiveSummary, lang?: ClientReportLang | null): string {
  const car = [s.title, s.vin].filter(Boolean).join(" · ");
  const fl = foreign(lang);
  if (fl) return fl.c.readySubject(car).slice(0, 180);
  return `Izsoļu arhīvs${car ? ` - ${car}` : ""}`.slice(0, 180);
}

export function auctionArchiveReadyText(s: AuctionArchiveSummary, showPrices = false, lang?: ClientReportLang | null): string {
  const f = auctionArchiveEmailFacts(s);
  const fl = foreign(lang);
  if (fl) {
    const { c } = fl;
    const what = [c.auctions(f.auctions || 1), f.photos > 0 ? c.photosCount(f.photos) : ""].filter(Boolean).join(", ");
    return [c.hello, "", c.readyLead(s.vin, what, showPrices), "", c.noSurcharge, "", ...foreignSign(c)].join("\n");
  }
  const what = [lvCount(f.auctions || 1, "izsole", "izsoles"), f.photos > 0 ? lvCount(f.photos, "bilde", "bildes") : ""].filter(Boolean).join(", ");
  return [
    "Labdien!",
    "",
    `Paldies par izvēli. Pielikumā izsoļu arhīvs auto VIN ${s.vin} (${what}) - bildes ar datumiem, ${showPrices ? "cenas, " : ""}nobraukums, bojājumi pa zonām un izsoles apraksts.`,
    "",
    "Piemaksa nav jāveic.",
    "",
    "Ar cieņu,",
    "Nils Valainis",
    "PROVIN.LV",
  ].join("\n");
}

export function auctionArchiveReadyWhatsappText(s: AuctionArchiveSummary, lang?: ClientReportLang | null): string {
  const fl = foreign(lang);
  if (fl) return `${fl.c.waReady(s.vin)}\nNils, PROVIN.LV`;
  return `Labdien! Paldies par izvēli - nosūtu izsoļu arhīvu auto VIN ${s.vin} (PDF). Piemaksa nav jāveic.\nNils, PROVIN.LV`;
}

export function auctionArchiveReadyEmailHtml(o: {
  summary: AuctionArchiveSummary;
  text: string;
  attachment: { filename: string; bytes: number };
  date?: Date;
  lang?: ClientReportLang | null;
}): string {
  const h = foreign(o.lang)?.c.html;
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
      eyebrow: h ? h.readyEyebrow : "Izsoļu arhīvs",
      title: h ? h.readyTitle : "Izsoļu arhīvs gatavs",
      car: o.summary.title || null,
      vin: o.summary.vin || null,
      date: formatEmailDate(o.date ?? new Date()),
    }),
    paragraphs ? emailRow(paragraphs, "22px 36px 0") : "",
    emailAttachmentsRow([{ name: o.attachment.filename, meta: ["PDF", formatEmailFileSize(o.attachment.bytes)].filter(Boolean).join(" · ") }]),
  ].join("\n");
  return emailDocument({ rows, lang: auctionArchiveForeignLang(o.lang) ?? "lv", preheader: h ? h.readyPreheader : "Izsoļu arhīvs pielikumā" });
}
