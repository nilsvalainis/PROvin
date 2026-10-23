import type { DropboxClient } from "@/lib/dropbox-client";
import {
  joinDropboxPath,
  matchStockFolderByVin,
  sanitizeDropboxName,
} from "@/lib/iriss-autoparks-dropbox-path";
import { normalizeVin } from "@/lib/order-field-validation";

/**
 * Oriģinālais LTAB PDF -> pasūtījuma mape Dropbox `/_PROv/<Marka Modelis Gads VIN>/`
 * (turpat, kur Nils liek AutoDNA / carVertical PDF). Esošo mapi atrod pēc VIN; ja nav, izveido jaunu.
 */

export function provOrdersDropboxRoot(env: NodeJS.ProcessEnv = process.env): string {
  const p = (env.PROV_ORDERS_DROPBOX_ROOT?.trim() || "/_PROv").replace(/\/+$/, "");
  return p.startsWith("/") ? p : `/${p}`;
}

export type LtabOrderCar = { vin: string; make: string; model: string; year: string; plate: string };

/** Jaunas mapes nosaukums kā Nila mapēm: "BMW 640i 2012 WBALW3C59CC891863". */
export function provOrderFolderName(car: LtabOrderCar): string {
  const vin = normalizeVin(car.vin);
  const title = [car.make, car.model, car.year].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  const id = vin.length === 17 ? vin : car.plate.trim().toUpperCase();
  return sanitizeDropboxName([title || "Auto", id].filter(Boolean).join(" "), 160) || "Auto";
}

export function ltabPdfFileName(plate: string): string {
  return `${sanitizeDropboxName(`LTAB - ${plate.trim().toUpperCase()}`, 80) || "LTAB"}.pdf`;
}

/**
 * Atrod vai izveido pasūtījuma mapi un augšupielādē PDF (nekad nepārraksta: `add` + autorename).
 * Pēc augšupielādes pārbauda, ka fails tiešām ir mapē (metadati caur API).
 */
export async function saveLtabPdfToOrderFolder(
  client: DropboxClient,
  car: LtabOrderCar,
  bytes: Uint8Array,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ path: string; name: string; size: number; folderCreated: boolean }> {
  const root = provOrdersDropboxRoot(env);
  const { entries } = await client.listAll(root, { recursive: false, maxPages: 20 });
  const folders = entries.filter((e) => e.tag === "folder");
  const vin = normalizeVin(car.vin);
  let folderPath = "";
  let folderCreated = false;
  if (vin.length === 17) {
    const hit = matchStockFolderByVin(
      folders.map((f) => f.name),
      vin,
    );
    if (hit.kind === "found") folderPath = folders[hit.index]!.pathDisplay || joinDropboxPath(root, hit.name);
    if (hit.kind === "ambiguous") {
      // Vairākas vienlīdz derīgas mapes (pilnā VIN priekšroku jau deva matchStockFolderByVin): pirmā pēc nosaukuma.
      const name = [...hit.names].sort()[0]!;
      folderPath = joinDropboxPath(root, name);
    }
  }
  if (!folderPath) {
    const entry = await client.ensureFolder(joinDropboxPath(root, provOrderFolderName(car)));
    folderPath = entry.pathDisplay || joinDropboxPath(root, provOrderFolderName(car));
    folderCreated = true;
  }
  const uploaded = await client.upload(joinDropboxPath(folderPath, ltabPdfFileName(car.plate)), bytes, "add");
  const check = await client.getMetadata(uploaded.id || uploaded.pathDisplay);
  if (!check || check.tag !== "file" || (check.size && check.size !== bytes.byteLength)) {
    throw new Error("dropbox_verify_failed");
  }
  return { path: check.pathDisplay || uploaded.pathDisplay, name: check.name || uploaded.name, size: bytes.byteLength, folderCreated };
}
