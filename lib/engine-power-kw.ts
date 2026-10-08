/**
 * Motora jauda sarakstiem: kW no teksta, vai hp/PS/ZS/HK → kW.
 * 1 hp (DIN/PS) = 0.7355 kW.
 */

export const HP_TO_KW = 0.7355;

const KW_MIN = 10;
const KW_MAX = 1500;
const HP_MIN = 15;
const HP_MAX = 2000;

export type ParseEnginePowerKwOptions = {
  /** Tukšs skaitlis bez mērvienības (piem. Autobid `eq19`) ir kW. */
  bareNumberIsKw?: boolean;
};

function parseLocaleNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function inRange(n: number, min: number, max: number): boolean {
  return n >= min && n <= max;
}

function firstMatchKw(text: string): number | null {
  const re = /(\d+(?:[.,]\d+)?)\s*kW\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseLocaleNumber(m[1] ?? "");
    if (n != null && inRange(n, KW_MIN, KW_MAX)) return Math.round(n);
  }
  return null;
}

function firstMatchHp(text: string): number | null {
  const re = /(\d+(?:[.,]\d+)?)\s*(?:bhp|hp|PS|ZS|HK)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseLocaleNumber(m[1] ?? "");
    if (n != null && inRange(n, HP_MIN, HP_MAX)) return Math.round(n * HP_TO_KW);
  }
  return null;
}

function bareKw(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(t)) return null;
  const n = parseLocaleNumber(t);
  if (n == null || !inRange(n, KW_MIN, KW_MAX)) return null;
  return Math.round(n);
}

/** Pirmais ticamais kW. Ja ir kW un hp, ņem kW. */
export function parseEnginePowerKwFromText(text: string, opts: ParseEnginePowerKwOptions = {}): number | null {
  const raw = text.replace(/\u00a0/g, " ").trim();
  if (!raw) return null;
  const fromKw = firstMatchKw(raw);
  if (fromKw != null) return fromKw;
  const fromHp = firstMatchHp(raw);
  if (fromHp != null) return fromHp;
  if (opts.bareNumberIsKw) return bareKw(raw);
  return null;
}

export function parseEnginePowerKwFromTexts(
  texts: readonly (string | null | undefined)[],
  opts: ParseEnginePowerKwOptions = {},
): number | null {
  for (const part of texts) {
    const n = parseEnginePowerKwFromText(part ?? "", opts);
    if (n != null) return n;
  }
  return null;
}

/** `"120 kW"` vai tukšs. */
export function formatEnginePowerKwLabel(kw: number | null | undefined): string {
  if (kw == null || !Number.isFinite(kw)) return "";
  const n = Math.round(kw);
  if (!inRange(n, KW_MIN, KW_MAX)) return "";
  return `${n} kW`;
}

export type IrissOrderPowerKwSource = {
  engineType?: string;
  equipmentRequired?: string;
  equipmentDesired?: string;
  notes?: string;
  brandModel?: string;
};

/** IRISS pasūtījums: dzinēja tips, aprīkojums, piezīmes, marka/modelis. */
export function formatIrissOrderPowerKwLabel(src: IrissOrderPowerKwSource): string {
  return formatEnginePowerKwLabel(
    parseEnginePowerKwFromTexts(
      [src.engineType, src.equipmentRequired, src.equipmentDesired, src.notes, src.brandModel],
      { bareNumberIsKw: false },
    ),
  );
}

/** Autobid/Openlane/Auto1 `powerKw` lauks (bieži tikai cipari). */
export function formatListingPowerKwLabel(powerKw: string | null | undefined): string {
  return formatEnginePowerKwLabel(parseEnginePowerKwFromText(powerKw ?? "", { bareNumberIsKw: true }));
}
