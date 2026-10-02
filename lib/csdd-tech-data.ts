/**
 * CSDD Transportlīdzekļu reģistra web serviss (līgums LĪG-ieņ/375/26, 1. pielikums).
 * `epak.tl_tehn_dati?nr1=` pieņem gan valsts numurzīmi, gan VIN, un atgriež XML `<TL_DATI>`.
 *
 * Serviss ir tikai CSDD privātajā tīklā (`ows.csdd.gov.lv:9999`, VPN vai IPSec), tāpēc
 * Vercel funkcija to sasniedz caur mūsu releju tunelī: `CSDD_RELAY_URL` + `CSDD_RELAY_TOKEN`.
 * Apjoms līgumā: 10 000 ierakstu mēnesī par pamata maksu, tāpēc atkārtotus zvanus ir vērts ķert ar kešu.
 */

/** Lauki tieši tā, kā tos atgriež serviss (teksts, kā reģistrā). */
export type CsddTechData = {
  registrationNumber: string;
  vin: string;
  make: string;
  model: string;
  /** Izlaiduma gads (`GADS`). */
  year: string;
  fuel: string;
  /** Motora jauda kW (`JAUDA`). */
  powerKw: string;
  /** Motora tilpums cm³ (`TILPUMS`). */
  displacementCm3: string;
  /** Pirmā reģistrācija ISO (`REG1`, avotā DDMMYYYY). */
  firstRegistrationIso: string;
  color: string;
  vehicleKind: string;
  cocCategory: string;
  cocType: string;
  cocApprovalNumber: string;
  cocVariant: string;
  cocVersion: string;
  grossMassKg: string;
  curbMassKg: string;
  /** OCTA polises beigu termiņš ISO (`POL_BEIGAS`). */
  insuranceEndIso: string;
  /** Tehniskās apskates termiņš ISO (`TA_LIDZ`). */
  inspectionValidUntilIso: string;
};

export type CsddTechDataResult =
  | { found: true; data: CsddTechData; message: string }
  | { found: false; message: string };

export function emptyCsddTechData(): CsddTechData {
  return {
    registrationNumber: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    fuel: "",
    powerKw: "",
    displacementCm3: "",
    firstRegistrationIso: "",
    color: "",
    vehicleKind: "",
    cocCategory: "",
    cocType: "",
    cocApprovalNumber: "",
    cocVariant: "",
    cocVersion: "",
    grossMassKg: "",
    curbMassKg: "",
    insuranceEndIso: "",
    inspectionValidUntilIso: "",
  };
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Pirmā `<TAG>` vērtība; CDATA un entītijas atšifrētas. */
export function csddXmlTagValue(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m?.[1]) return "";
  const inner = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeXmlEntities(inner).replace(/\s+/g, " ").trim();
}

/** CSDD datumi ir `DDMMYYYY` bez atdalītājiem; tukšs vai `00000000` nozīmē, ka datuma nav. */
export function csddApiDateToIso(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function digitsOnly(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  return d;
}

/** Tīra funkcija: parsē `<TL_DATI>` atbildi. */
export function parseCsddTechDataXml(xmlRaw: string): CsddTechDataResult {
  const xml = xmlRaw.trim();
  if (!xml) return { found: false, message: "CSDD atbilde bija tukša" };
  if (!/<TL_DATI\b/i.test(xml)) {
    return { found: false, message: "CSDD atbildē nav transportlīdzekļa datu" };
  }

  const data: CsddTechData = {
    registrationNumber: csddXmlTagValue(xml, "RN"),
    vin: csddXmlTagValue(xml, "VIN").toUpperCase(),
    make: csddXmlTagValue(xml, "MARKA"),
    model: csddXmlTagValue(xml, "MODELIS"),
    year: digitsOnly(csddXmlTagValue(xml, "GADS")),
    fuel: csddXmlTagValue(xml, "DEGVIELA"),
    powerKw: digitsOnly(csddXmlTagValue(xml, "JAUDA")),
    displacementCm3: digitsOnly(csddXmlTagValue(xml, "TILPUMS")),
    firstRegistrationIso: csddApiDateToIso(csddXmlTagValue(xml, "REG1")),
    color: csddXmlTagValue(xml, "KRASA"),
    vehicleKind: csddXmlTagValue(xml, "TL_VEIDS"),
    cocCategory: csddXmlTagValue(xml, "COC_KATEGORIJA"),
    cocType: csddXmlTagValue(xml, "COC_TIPS"),
    cocApprovalNumber: csddXmlTagValue(xml, "COC_TEHN_APST_NUM"),
    cocVariant: csddXmlTagValue(xml, "COC_VARIANTS"),
    cocVersion: csddXmlTagValue(xml, "COC_VERSIJA"),
    grossMassKg: digitsOnly(csddXmlTagValue(xml, "PILNA_MASA")),
    curbMassKg: digitsOnly(csddXmlTagValue(xml, "PASMASA")),
    insuranceEndIso: csddApiDateToIso(csddXmlTagValue(xml, "POL_BEIGAS")),
    inspectionValidUntilIso: csddApiDateToIso(csddXmlTagValue(xml, "TA_LIDZ")),
  };

  if (!data.vin && !data.registrationNumber) {
    return { found: false, message: "CSDD reģistrā šāds numurs netika atrasts" };
  }

  const label = [data.make, data.model].filter(Boolean).join(" ") || data.registrationNumber || data.vin;
  return { found: true, data, message: `CSDD tehniskie dati ielasīti (${label})` };
}

/**
 * Oracle PL/SQL vārti var atdot windows-1257 vai ISO-8859-13, nevis UTF-8.
 * Tad `ŠKODA` un `Pelēka` bez pareizā dekodētāja sabojātos, tāpēc kodējumu ņemam no `Content-Type`.
 */
export function decodeCsddXmlBody(buf: ArrayBuffer, contentType: string | null): string {
  const declared = contentType?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase() ?? "";
  const candidates = declared ? [declared, "utf-8"] : ["utf-8"];
  for (const charset of candidates) {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(buf);
    } catch {
      /* nākamais kodējums */
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export function csddTechDataLookupPath(nr1: string): string {
  return `/zvt/plsql/epak.tl_tehn_dati?nr1=${encodeURIComponent(nr1.trim().toUpperCase())}`;
}

type CsddRelayEnv = Record<string, string | undefined>;

/** `{nr1}` šablonā vai relejs, kas pats pieliek ceļu. */
export function buildCsddRelayUrl(relayBase: string, nr1: string): string {
  const nr = nr1.trim().toUpperCase();
  const base = relayBase.trim();
  if (base.includes("{nr1}")) return base.split("{nr1}").join(encodeURIComponent(nr));
  return `${base.replace(/\/$/, "")}${csddTechDataLookupPath(nr)}`;
}

export const CSDD_TECH_DATA_TIMEOUT_MS = 20_000;

/** Ielasa tehniskos datus caur releju CSDD tunelī. */
export async function fetchCsddTechData(
  nr1: string,
  opts: { env?: CsddRelayEnv; timeoutMs?: number } = {},
): Promise<CsddTechDataResult> {
  const env = opts.env ?? process.env;
  const relay = env.CSDD_RELAY_URL?.trim() ?? "";
  if (!relay) return { found: false, message: "CSDD relejs nav konfigurēts" };
  if (!nr1.trim()) return { found: false, message: "Nav VIN vai reģistrācijas numura" };

  const token = env.CSDD_RELAY_TOKEN?.trim() ?? "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? CSDD_TECH_DATA_TIMEOUT_MS);
  try {
    const res = await fetch(buildCsddRelayUrl(relay, nr1), {
      method: "GET",
      headers: {
        Accept: "application/xml,text/xml,*/*;q=0.8",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[csdd] relejs HTTP", res.status);
      return {
        found: false,
        message:
          res.status === 401 || res.status === 403
            ? "CSDD relejs noraidīja pieprasījumu (tokens vai lietotājs)"
            : `CSDD neatbildēja (HTTP ${res.status})`,
      };
    }
    const body = decodeCsddXmlBody(await res.arrayBuffer(), res.headers.get("content-type"));
    return parseCsddTechDataXml(body);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { found: false, message: aborted ? "CSDD pieprasījums noildza" : "Neizdevās sasniegt CSDD releju" };
  } finally {
    clearTimeout(timer);
  }
}
