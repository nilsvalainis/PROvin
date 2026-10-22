/**
 * Autoparks <-> Dropbox /STOCK mapes: nosaukumi un meklēšana (tīra loģika, bez tīkla).
 * Paraugs: "Marka Modelis Gads krāsa – <VIN pēdējie 6> – A1|AB|OL" (atdalītājs ir Dropbox mapju
 * vēsturiskā zīme U+2013 - to saglabājam, lai jaunās mapes sakristu ar esošajām).
 */

import { AUTOPARKS_STAGE_LV, type AutoparksCar, type AutoparksOwner, type AutoparksStage } from "@/lib/iriss-autoparks";

export const STOCK_SEPARATOR = " – ";

export type { AutoparksOwner };

/** Saknes mapes: IRISS = /STOCK, DZA = /SIA DZINTARZEME AUTO/STOCK. Env var pārrakstīt. */
export function autoparksDropboxRoot(owner: AutoparksOwner = "IRISS", env: NodeJS.ProcessEnv = process.env): string {
  const raw = owner === "DZA" ? env.AUTOPARKS_DROPBOX_DZA_ROOT : env.AUTOPARKS_DROPBOX_ROOT;
  const fallback = owner === "DZA" ? "/SIA DZINTARZEME AUTO/STOCK" : "/STOCK";
  const p = (raw?.trim() || fallback).replace(/\/+$/, "");
  return p.startsWith("/") ? p : `/${p}`;
}

/** Izsoles saīsinājums mapes nosaukuma beigās. */
export function autoparksSourceCode(auction: string | null | undefined): string {
  switch ((auction ?? "").trim().toLowerCase()) {
    case "auto1":
      return "A1";
    case "autobid":
      return "AB";
    case "openlane":
      return "OL";
    case "bca":
      return "BCA";
    default:
      return "";
  }
}

/** Dropbox aizliegtās zīmes un beigu punkti/atstarpes ārā; garums ierobežots. */
export function sanitizeDropboxName(name: string, max = 120): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "");
  return cleaned;
}

export function vinTail(vin: string): string {
  const v = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v.length >= 6 ? v.slice(-6) : "";
}

export function autoparksStockFolderName(
  car: Pick<AutoparksCar, "make" | "model" | "year" | "color" | "vin">,
  auction?: string | null,
): string {
  const title = [car.make, car.model, car.year, car.color.toLowerCase()].map((s) => s.trim()).filter(Boolean).join(" ") || "Auto";
  const parts = [title, vinTail(car.vin) || car.vin.trim().toUpperCase() || "bez VIN"];
  const code = autoparksSourceCode(auction);
  if (code) parts.push(code);
  return sanitizeDropboxName(parts.join(STOCK_SEPARATOR), 160);
}

function tokens(name: string): string[] {
  return name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
}

export type StockFolderMatch = { kind: "found"; name: string; index: number } | { kind: "none" } | { kind: "ambiguous"; names: string[] };

/**
 * Esošā mape pēc VIN: nosaukumā ir VIN pēdējie 6 kā atsevišķs vārds vai pilnais VIN.
 * Arhīva/servisa mapes ("_ Arhīvs", "_ Pasūtījumi") ignorē. Vairāki trāpījumi = neskaidrs (neko nesaista).
 */
export function matchStockFolderByVin(folderNames: readonly string[], vin: string): StockFolderMatch {
  const full = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tail = vinTail(full);
  if (!tail) return { kind: "none" };
  const hits: number[] = [];
  folderNames.forEach((name, i) => {
    if (name.trim().startsWith("_")) return;
    const t = tokens(name);
    if (t.includes(tail) || (full.length >= 11 && t.includes(full))) hits.push(i);
  });
  if (hits.length === 0) return { kind: "none" };
  if (hits.length === 1) return { kind: "found", name: folderNames[hits[0]!]!, index: hits[0]! };
  const exact = hits.filter((i) => full.length >= 11 && tokens(folderNames[i]!).includes(full));
  if (exact.length === 1) return { kind: "found", name: folderNames[exact[0]!]!, index: exact[0]! };
  return { kind: "ambiguous", names: hits.map((i) => folderNames[i]!) };
}

/** Faila nosaukums auto mapē: "Serviss - Rēķins.pdf". Konfliktus atrisina Dropbox autorename. */
export function autoparksDropboxFileName(stage: AutoparksStage, title: string, fileName: string, contentType: string): string {
  const ext = (fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? (contentType.includes("pdf") ? ".pdf" : "")).toLowerCase();
  const base = sanitizeDropboxName(`${AUTOPARKS_STAGE_LV[stage]} - ${title || fileName.replace(/\.[a-z0-9]{2,5}$/i, "")}`, 140) || "Dokuments";
  return `${base}${ext}`;
}

export function joinDropboxPath(folder: string, name: string): string {
  return `${folder.replace(/\/+$/, "")}/${name}`;
}

/** Vai `path` ir `folder` iekšienē (reģistrnejutīgi, kā Dropbox path_lower). */
export function isInsideDropboxFolder(path: string, folder: string): boolean {
  const p = path.toLowerCase();
  const f = folder.toLowerCase().replace(/\/+$/, "");
  return p.startsWith(`${f}/`);
}
