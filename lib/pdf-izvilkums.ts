/**
 * «Izvilkums» (Nils 25.11.2026): individuāli sagatavota, ierobežota apjoma atskaite.
 * Ar admin ķeksīti klienta PDF saņem ūdenszīmi katrā lapā, papildu kājenes rindu
 * un produkta vārda vietā «Izvilkums» (galvene, kolofons).
 */

import { pdfTopTextEm } from "@/lib/pdf-report-top";

export type IzvilkumsLang = "lv" | "en" | "ru" | "de";

const WORD: Record<IzvilkumsLang, string> = {
  lv: "Izvilkums",
  en: "Extract",
  ru: "Выписка",
  de: "Auszug",
};

const FOOTER_NOTE: Record<IzvilkumsLang, string> = {
  lv: "Izvilkums - sagatavots individuāli no daļas PROVIN avotu. Pilnajā PROVIN auditā - plašāka datu pārbaude un ieteikumi.",
  en: "Extract - prepared individually from part of PROVIN sources. The full PROVIN audit includes a broader data check and recommendations.",
  ru: "Выписка - подготовлена индивидуально на основе части источников PROVIN. Полный аудит PROVIN включает более широкую проверку данных и рекомендации.",
  de: "Auszug - individuell aus einem Teil der PROVIN-Quellen erstellt. Das vollständige PROVIN-Audit umfasst eine umfassendere Datenprüfung und Empfehlungen.",
};

/** Produkta vārds galvenē («Izvilkums · Datu atskaite · datums»). */
export function izvilkumsWord(lang: IzvilkumsLang = "lv"): string {
  return WORD[lang] ?? WORD.lv;
}

/** Ūdenszīmes / kolofona vārds lielajiem burtiem («IZVILKUMS», «EXTRACT», «ВЫПИСКА», «AUSZUG»). */
export function izvilkumsWordUpper(lang: IzvilkumsLang = "lv"): string {
  return izvilkumsWord(lang).toLocaleUpperCase(lang === "lv" ? "lv" : lang);
}

/** Kājenes rinda zem esošās lapas kājenes. */
export function izvilkumsFooterNote(lang: IzvilkumsLang = "lv"): string {
  return FOOTER_NOTE[lang] ?? FOOTER_NOTE.lv;
}

/** A4 lapas diagonāle: no apakšējā kreisā uz augšējo labo stūri. */
const A4_W_MM = 210;
const A4_H_MM = 297;
export const IZVILKUMS_WATERMARK_ANGLE_DEG = -((Math.atan2(A4_H_MM, A4_W_MM) * 180) / Math.PI);
/** ~70 % no lapas diagonāles garuma. */
const WATERMARK_LEN_PX = Math.hypot(A4_W_MM, A4_H_MM) * 0.7 * (96 / 25.4);
/** Inter 800 ir ~8 % platāks par `pdfTopTextEm` (400/600) aplēsi. */
const HEAVY_FACTOR = 1.08;

/** Burtu izmērs (px), lai vārds aizņem ~70 % diagonāles. */
export function izvilkumsWatermarkFontPx(word: string): number {
  const em = pdfTopTextEm(word, { tracking: 0.02 }) * HEAVY_FACTOR;
  return Math.round((WATERMARK_LEN_PX / Math.max(em, 1)) * 4) / 4;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * `position: fixed` drukā Chromium atkārto katrā lapā (arī garās sadaļās, kas pārrāvumā turpinās).
 * Virs satura ar ļoti zemu necaurredzamību: teksts lasāms, saites PDF paliek (pointer-events: none).
 */
export function buildIzvilkumsWatermarkHtml(lang: IzvilkumsLang = "lv"): string {
  const word = izvilkumsWordUpper(lang);
  const px = izvilkumsWatermarkFontPx(word);
  return `<div class="pdf-izvilkums-wm" aria-hidden="true"><span class="pdf-izvilkums-wm__t" style="font-size:${px}px">${esc(word)}</span></div>`;
}

export const PDF_IZVILKUMS_CSS = `
      .pdf-izvilkums-wm{
        position:fixed;inset:0;z-index:2147483000;pointer-events:none;user-select:none;
        display:flex;align-items:center;justify-content:center;overflow:hidden;
      }
      .pdf-izvilkums-wm__t{
        display:block;white-space:nowrap;line-height:1;
        font-family:Inter,sans-serif;font-weight:800;letter-spacing:0.02em;
        color:rgba(29,29,31,0.055);
        transform:rotate(${IZVILKUMS_WATERMARK_ANGLE_DEG.toFixed(2)}deg);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      @media print{ .pdf-izvilkums-wm{overflow:visible;} }
      @media screen and (max-width:720px){ .pdf-izvilkums-wm__t{font-size:30vw!important;} }
`;
