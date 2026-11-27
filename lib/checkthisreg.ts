/**
 * CheckThisReg.com - ārējs dīlera datu avots (Nila prasība 27.11.2026): dažām markām (sākumā Renault)
 * dīlera servisa dati ir tur. Dīlera datu pasūtījumā blakus ielases pogai rāda pogu «CheckThisReg»,
 * kas atver vietni jaunā cilnē un nokopē VIN starpliktuvē (vietnei nav publiska VIN URL parametra -
 * pārbaudīts 27.11, tāpēc tikai sākumlapa).
 *
 * Markas sarakstu papildina tikai šeit (CHECKTHISREG_STRONG_MAKES + WMI tabula).
 */

export const CHECKTHISREG_URL = "https://checkthisreg.com/";

/** Markas, kurām CheckThisReg ir spēcīgs dīlera datu avots (lielie burti). */
export const CHECKTHISREG_STRONG_MAKES = ["RENAULT"] as const;

/** VIN WMI (1.-3. zīme) -> marka no CHECKTHISREG_STRONG_MAKES. Dacia (UU1) apzināti nav. */
export const CHECKTHISREG_WMI: Readonly<Record<string, (typeof CHECKTHISREG_STRONG_MAKES)[number]>> = {
  VF1: "RENAULT",
  VF2: "RENAULT",
  VF6: "RENAULT",
  VF8: "RENAULT",
  VS5: "RENAULT",
  X7L: "RENAULT",
};

const DISPLAY: Record<string, string> = { RENAULT: "Renault" };

function displayMake(upper: string): string {
  return DISPLAY[upper] ?? upper.charAt(0) + upper.slice(1).toLowerCase();
}

function normWords(s: string): string[] {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export type CheckThisRegMakeInput = {
  vin?: string | null;
  /** Markas teksti no pasūtījuma datiem (CSDD «Marka, modelis», CSDD API marka, OneAuto/Outvin u.c.). */
  makeTexts?: readonly (string | null | undefined)[];
};

/**
 * Atgriež markas nosaukumu (piem. «Renault»), ja auto ir CheckThisReg spēcīgā marka; citādi null.
 * Teksta marka (CSDD u.c.) ir noteicošā: ja tā ir aizpildīta un nav sarakstā (piem. «Dacia»),
 * VIN WMI netiek ņemts vērā. Ja teksta markas nav - pēc VIN WMI.
 */
export function checkThisRegMake(input: CheckThisRegMakeInput): string | null {
  const texts = (input.makeTexts ?? []).map((t) => (t ?? "").trim()).filter(Boolean);
  for (const t of texts) {
    const words = normWords(t);
    const hit = CHECKTHISREG_STRONG_MAKES.find((m) => words.includes(m));
    if (hit) return displayMake(hit);
  }
  if (texts.length > 0) return null;
  const vin = (input.vin ?? "").trim().toUpperCase();
  if (vin.length < 3) return null;
  const byWmi = CHECKTHISREG_WMI[vin.slice(0, 3)];
  return byWmi ? displayMake(byWmi) : null;
}

/** Markas teksti no pasūtījuma avotu blokiem (bez importa, lai nav cikla). */
export function checkThisRegMakeTexts(blocks: {
  csdd?: { makeModel?: string; registry?: { data?: { make?: string } } } | null;
} | null | undefined): string[] {
  if (!blocks) return [];
  return [blocks.csdd?.registry?.data?.make ?? "", blocks.csdd?.makeModel ?? ""].filter((s) => s.trim());
}

/** Izcelšana: dīlera ielase beidzās bez datiem (vai kļūda). */
export function checkThisRegHighlighted(jobStatus: string | null | undefined): boolean {
  return jobStatus === "no_data" || jobStatus === "failed";
}

export function checkThisRegHint(make: string): string {
  return `${make} dati - CheckThisReg`;
}

/** VIN starpliktuvē (navigator.clipboard, citādi textarea + execCommand). Kļūdas klusē. */
export function copyVinToClipboard(vin: string): void {
  const v = vin.trim();
  if (!v || typeof window === "undefined") return;
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = v;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* nav kritiski */
    }
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(v).catch(fallback);
      return;
    }
  } catch {
    /* fallback zemāk */
  }
  fallback();
}
