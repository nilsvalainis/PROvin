import type { DropboxClient } from "@/lib/dropbox-client";
import {
  joinDropboxPath,
  matchStockFolderByVin,
  sanitizeDropboxName,
} from "@/lib/iriss-autoparks-dropbox-path";
import { normalizeVin } from "@/lib/order-field-validation";
import { dealerForecastMakeFromVin } from "@/lib/dealer-coverage-forecast";
import { decodeVinLocal } from "@/lib/vin-scan/vin-decode";

/**
 * Oriģinālais LTAB PDF -> pasūtījuma mape Dropbox `/_PROv/<Marka Modelis Gads VIN>/`
 * (turpat, kur Nils liek AutoDNA / carVertical PDF). Esošo mapi atrod pēc VIN; ja nav, izveido jaunu.
 */

export function provOrdersDropboxRoot(env: NodeJS.ProcessEnv = process.env): string {
  const p = (env.PROV_ORDERS_DROPBOX_ROOT?.trim() || "/_PROv").replace(/\/+$/, "");
  return p.startsWith("/") ? p : `/${p}`;
}

export type LtabOrderCar = { vin: string; make: string; model: string; year: string; plate: string };

/**
 * Jaunas mapes nosaukums kā Nila mapēm: "BMW 640i 2012 WBALW3C59CC891863". Nils 27.11: mapei jāsākas ar marku -
 * ja markas nav (ārzemju VIN bez CSDD), marka no VIN WMI, nevis «Auto».
 */
export function provOrderFolderName(car: LtabOrderCar): string {
  const vin = normalizeVin(car.vin);
  const make = (car.make ?? "").trim() || (vin.length === 17 ? decodeVinLocal(vin).make || dealerForecastMakeFromVin(vin) || "" : "");
  const title = [make, car.model, car.year].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  const id = vin.length === 17 ? vin : car.plate.trim().toUpperCase();
  return sanitizeDropboxName([title || "Auto", id].filter(Boolean).join(" "), 160) || "Auto";
}

export function ltabPdfFileName(plate: string): string {
  return `${sanitizeDropboxName(`LTAB - ${plate.trim().toUpperCase()}`, 80) || "LTAB"}.pdf`;
}

/** Atrod pasūtījuma mapi `/_PROv/` pēc VIN vai izveido jaunu ("Marka Modelis Gads VIN"). */
export async function findOrCreateProvOrderFolder(
  client: DropboxClient,
  car: LtabOrderCar,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ folderPath: string; folderCreated: boolean }> {
  const root = provOrdersDropboxRoot(env);
  const { entries } = await client.listAll(root, { recursive: false, maxPages: 20 });
  const folders = entries.filter((e) => e.tag === "folder");
  const vin = normalizeVin(car.vin);
  if (vin.length === 17) {
    const hit = matchStockFolderByVin(
      folders.map((f) => f.name),
      vin,
    );
    if (hit.kind === "found") return { folderPath: folders[hit.index]!.pathDisplay || joinDropboxPath(root, hit.name), folderCreated: false };
    if (hit.kind === "ambiguous") {
      // Vairākas vienlīdz derīgas mapes (pilnā VIN priekšroku jau deva matchStockFolderByVin): pirmā pēc nosaukuma.
      return { folderPath: joinDropboxPath(root, [...hit.names].sort()[0]!), folderCreated: false };
    }
  }
  const entry = await client.ensureFolder(joinDropboxPath(root, provOrderFolderName(car)));
  return { folderPath: entry.pathDisplay || joinDropboxPath(root, provOrderFolderName(car)), folderCreated: true };
}

/**
 * Augšupielādē failu pasūtījuma mapē (nekad nepārraksta: `add` + autorename).
 * Pēc augšupielādes pārbauda, ka fails tiešām ir mapē (metadati caur API).
 */
export async function saveFileToProvOrderFolder(
  client: DropboxClient,
  car: LtabOrderCar,
  fileName: string,
  bytes: Uint8Array,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ path: string; name: string; size: number; folderCreated: boolean }> {
  const { folderPath, folderCreated } = await findOrCreateProvOrderFolder(client, car, env);
  const uploaded = await client.upload(joinDropboxPath(folderPath, fileName), bytes, "add");
  const check = await client.getMetadata(uploaded.id || uploaded.pathDisplay);
  if (!check || check.tag !== "file" || (check.size && check.size !== bytes.byteLength)) {
    throw new Error("dropbox_verify_failed");
  }
  return { path: check.pathDisplay || uploaded.pathDisplay, name: check.name || uploaded.name, size: bytes.byteLength, folderCreated };
}

/** Oriģinālais LTAB PDF pasūtījuma mapē. */
export async function saveLtabPdfToOrderFolder(
  client: DropboxClient,
  car: LtabOrderCar,
  bytes: Uint8Array,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ path: string; name: string; size: number; folderCreated: boolean }> {
  return saveFileToProvOrderFolder(client, car, ltabPdfFileName(car.plate), bytes, env);
}
