/**
 * Dānijas Bilbogen (kustamās mantas ķīlu / parādu reģistrs) ieraksti no tjekbil.dk `debtData.laaneDokumenter`.
 *
 * 26.11 (Nils): ķīla / parāds ir apgrūtinājums, NEVIS negadījums. Līdz šim tjekbil to ielika negadījumu
 * tabulā, un PDF / AI / VIN SCAN to rādīja kā avāriju. Tagad ķīla ir reģistra bloka statusu rindās
 * (`statusRecords`) ar datumu, dokumenta veidu, parāda summu un ķīlas ņēmēju (tikai uzņēmums - privātpersonu
 * vārdus un dzimšanas datumus neņemam), un piezīmēs paliek sarkanais karogs «Reģistrēta ķīla».
 */
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { asArray, asRecord, isoDay, str, validIsoDay } from "@/lib/vin-sources/dk-json";

export const DK_LIEN_LABEL = "Ķīla / parāds (Bilbogen)";

/** Saglabātā negadījuma rinda (pirms 26.11), kas patiesībā ir ķīla. */
export const LEGACY_LIEN_INCIDENT_RE = /^\s*ķīla\s*\/\s*parāds\b/i;

/** Statusu / piezīmju teksts, kas norāda uz reģistrētu ķīlu vai parādu. */
export const DK_LIEN_TEXT_RE = /ķīla\s*\/\s*parāds|reģistrēta\s+ķīla|bilbogen/i;

export type DkLien = {
  /** ISO diena vai "". */
  date: string;
  /** Dokumenta veids latviski (ar oriģinālu iekavās). */
  type: string;
  /** Parāda (pamatsummas) summa ar valūtu, piem. „300 000 DKK”. */
  amount: string;
  /** Ķīlas ņēmējs / kreditors - tikai uzņēmums. */
  holder: string;
};

const DOC_TYPE_LV: Record<string, string> = {
  ejerpantebrev: "īpašnieka ķīlas zīme (ejerpantebrev)",
  pantebrev: "ķīlas zīme (pantebrev)",
  loesoerepantebrev: "kustamās mantas ķīlas zīme (løsørepantebrev)",
  "løsørepantebrev": "kustamās mantas ķīlas zīme (løsørepantebrev)",
  gaeldsbrev: "parādzīme (gældsbrev)",
  "gældsbrev": "parādzīme (gældsbrev)",
  virksomhedspant: "uzņēmuma ķīla (virksomhedspant)",
  ejendomsforbehold: "īpašuma tiesību atruna (ejendomsforbehold)",
  udlaeg: "piedziņas arests (udlæg)",
  "udlæg": "piedziņas arests (udlæg)",
  arrest: "arests (arrest)",
};

/** Uzņēmuma nosaukums (banka, līzings, A/S, ApS ...). Privātpersonu vārdus klienta tekstā neliekam. */
const COMPANY_RE =
  /\b(a\/s|aps|i\/s|k\/s|p\/s|amba|a\.m\.b\.a|as|ab|asa|oy|gmbh|ltd|bank|banken|sparekasse[n]?|spar|nordea|danske|jyske|finans|finance|leasing|kredit|credit|pension|forsikring|holding|fond)\b/i;

function lienDocTypeLv(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  return DOC_TYPE_LV[key] ?? raw.trim();
}

/** „300000 DKK” -> „300 000 DKK”; „2930.00” -> „2 930,00”. */
export function formatLienAmount(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = /^([\d\s.,]+?)\s*([A-Za-zÆØÅæøå€$]{1,4})?$/.exec(s);
  if (!m) return s;
  const numPart = m[1]!.replace(/\s+/g, "");
  const cur = (m[2] ?? "").replace(/^kr\.?$/i, "DKK");
  const dec = /^(\d+)[.,](\d{2})$/.exec(numPart);
  const intDigits = dec ? dec[1]! : numPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intDigits)) return s;
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const n = dec && dec[2] !== "00" ? `${grouped},${dec[2]}` : grouped;
  return cur ? `${n} ${cur.toUpperCase() === "€" ? "€" : cur.toUpperCase()}` : n;
}

/**
 * Bilbogen datums. `loebeNummer` sākas ar reģistrācijas dienu `YYYYMMDD-...` - tas ir drošākais avots.
 * `dato` tjekbil atdod ASV formātā „10/24/2022” (MM/DD/YYYY).
 */
export function tjekbilLienDate(doc: Record<string, unknown>): string {
  const serial = /^(\d{4})(\d{2})(\d{2})-/.exec(str(doc.loebeNummer).trim());
  if (serial) {
    const fromSerial = validIsoDay(Number(serial[1]), Number(serial[2]), Number(serial[3]));
    if (fromSerial) return fromSerial;
  }
  return isoDay(doc.dato ?? doc.date, { slashOrder: "mdy" });
}

function companyNames(list: unknown): string[] {
  return asArray(list)
    .map((item) => (typeof item === "string" ? item : str(asRecord(item).navn ?? asRecord(item).name)))
    .map((n) => n.trim())
    .filter((n) => n && COMPANY_RE.test(n));
}

export function parseTjekbilLiens(laaneDokumenter: unknown): DkLien[] {
  return asArray(laaneDokumenter)
    .map(asRecord)
    .map((d) => {
      const pledgee = str(d.underpanthaver).trim();
      const holders = [
        ...(pledgee && COMPANY_RE.test(pledgee) ? [pledgee] : []),
        ...companyNames(d.kreditorer),
        ...(COMPANY_RE.test(str(d.kreditor ?? d.creditor)) ? [str(d.kreditor ?? d.creditor).trim()] : []),
      ];
      return {
        date: tjekbilLienDate(d),
        type: lienDocTypeLv(str(d.dokumentType ?? d.type)),
        amount: formatLienAmount(str(d.hovedStol ?? d.beloeb ?? d.amount)),
        holder: [...new Set(holders)].join(", "),
      };
    });
}

export function formatDkLienLine(lien: DkLien): string {
  const parts = [
    lien.date ? formatRegistryDateLv(lien.date) : "",
    lien.type,
    lien.amount ? `parāda summa ${lien.amount}` : "",
    lien.holder ? `ķīlas ņēmējs ${lien.holder}` : "",
  ].filter(Boolean);
  return parts.length ? `${DK_LIEN_LABEL}: ${parts.join(" · ")}` : `${DK_LIEN_LABEL}: reģistrēta`;
}

/** Atrod `laaneDokumenter` saglabātajā RAW JSON (tjekbil + nummerplade apvienojums). */
export function liensFromTjekbilRaw(raw: string): DkLien[] | null {
  if (!raw || !raw.includes("laaneDokumenter")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const stack: unknown[] = [parsed];
  let guard = 0;
  while (stack.length > 0 && guard++ < 5000) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    const rec = cur as Record<string, unknown>;
    if (Array.isArray(rec.laaneDokumenter)) return parseTjekbilLiens(rec.laaneDokumenter);
    stack.push(...Object.values(rec));
  }
  return null;
}
