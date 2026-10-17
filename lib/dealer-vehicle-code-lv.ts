/**
 * BMW / dīlera kodi klienta tekstā un PDF tabulā (deterministiski).
 */
export type DealerVehicleCodeField = "steeringSide" | "drive" | "body" | string;

const EXACT: Record<string, Partial<Record<string, string>>> = {
  steeringSide: {
    LL: "kreisā stūre",
    L: "kreisā stūre",
    RL: "labā stūre",
    R: "labā stūre",
  },
  drive: {
    HECK: "aizmugurējā piedziņa",
    RWD: "aizmugurējā piedziņa",
    ALLR: "pilnpiedziņa",
    AWD: "pilnpiedziņa",
    "4WD": "pilnpiedziņa",
    FRONT: "priekšējā piedziņa",
    FWD: "priekšējā piedziņa",
  },
  body: {
    TOU: "universālis",
    SAV: "apvidus",
    LIM: "sedans",
  },
};

/** Tulko vienu dīlera kodu. Ja nav vārdnīcā, atstāj oriģinālu. */
export function translateDealerVehicleCodeLv(field: DealerVehicleCodeField, value: string): string {
  const t = value.trim();
  if (!t) return t;
  const map = EXACT[field];
  const hit = map?.[t.toUpperCase()];
  return hit ?? t;
}

/** Komentāru pēcapstrāde: atsevišķi kodi teikumā. */
export function replaceDealerVehicleCodesInText(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/\bStūre\s+LL\b/g, "Stūre: kreisā stūre");
  out = out.replace(/\bPiedziņa\s+HECK\b/g, "Piedziņa: aizmugurējā piedziņa");
  out = out.replace(/\bPiedziņa\s+ALLR\b/g, "Piedziņa: pilnpiedziņa");
  out = out.replace(/\bVirsbūve\s+TOU\b/g, "Virsbūve: universālis");
  out = out.replace(/\bVirsbūve\s+SAV\b/g, "Virsbūve: apvidus");
  out = out.replace(/\bVirsbūve\s+LIM\b/g, "Virsbūve: sedans");
  out = out.replace(/\bHECK\b(?:\s*\(\s*aizmugures piedziņa\s*\))?/g, "aizmugurējā piedziņa");
  out = out.replace(/\bALLR\b/g, "pilnpiedziņa");
  out = out.replace(/\b\bTOU\b(?=\s|$|,|\.)/g, "universālis");
  out = out.replace(/\bSAV\b(?=\s|$|,|\.)/g, "apvidus");
  return out;
}
