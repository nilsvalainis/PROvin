/**
 * IRISS tālrunis: +371 tikai LV numuriem. Ārzemju numuru bez + nepārraksta.
 */

export type IrissPhoneInspect = {
  value: string;
  /** Normalizētā vērtība zvanam / WhatsApp (var būt tukša). */
  hrefValue: string;
  warning: string | null;
  appliedLvPrefix: boolean;
};

const LV_WARN = "Numurs nav Latvijas formātā. Pārbaudi valsts kodu (sākas ar +).";

export function inspectIrissPhone(raw: string): IrissPhoneInspect {
  const trimmed = raw.trim();
  if (!trimmed) return { value: "", hrefValue: "", warning: null, appliedLvPrefix: false };

  if (trimmed.startsWith("+")) {
    const cleaned = `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
    return { value: cleaned, hrefValue: cleaned, warning: null, appliedLvPrefix: false };
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return { value: "", hrefValue: "", warning: null, appliedLvPrefix: false };

  if (digits.startsWith("00371")) {
    const value = `+${digits.slice(2)}`;
    return { value, hrefValue: value, warning: null, appliedLvPrefix: false };
  }
  if (digits.startsWith("371") && digits.length >= 11) {
    const value = `+${digits}`;
    return { value, hrefValue: value, warning: null, appliedLvPrefix: false };
  }
  if (digits.startsWith("00") && digits.length > 6) {
    const value = `+${digits.slice(2)}`;
    return { value, hrefValue: value, warning: null, appliedLvPrefix: false };
  }
  if (digits.length === 8 && /^[26]/.test(digits)) {
    const value = `+371${digits}`;
    return { value, hrefValue: value, warning: null, appliedLvPrefix: true };
  }

  return {
    value: trimmed,
    hrefValue: digits.length >= 8 ? `+${digits}` : trimmed,
    warning: LV_WARN,
    appliedLvPrefix: false,
  };
}

/** Atpakaļsaderība ar editora `normalizePhoneForLv`. LV 8 cipari joprojām +371. */
export function normalizePhoneForLv(raw: string): string {
  return inspectIrissPhone(raw).hrefValue;
}
