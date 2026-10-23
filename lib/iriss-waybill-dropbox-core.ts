import { DropboxApiError, type DropboxClient, type DropboxEntry } from "@/lib/dropbox-client";

/**
 * Izdotās pavadzīmes PDF -> Dropbox (tā pati mape, ko lieto Aivars). Idempotents:
 * - ja mapē (arī `Arhīvs/`) jau ir fails ar šo pavadzīmes numuru - to izmanto, neko neaugšupielādē;
 * - augšupielāde `add` bez autorename: esošu failu nekad nepārraksta un nedzēš;
 * - pēc augšupielādes pārbauda ar get_metadata (size > 0).
 * Atkārto līdz `attempts` reizēm (tīkla / Dropbox kļūdas).
 */

export type WaybillDropboxDeps = {
  client: Pick<DropboxClient, "getMetadata" | "upload" | "listAll">;
  sleep?: (ms: number) => Promise<void>;
};

export type WaybillDropboxSaveResult =
  | { ok: true; path: string; size: number; reused: boolean }
  | { ok: false; error: string };

function errText(err: unknown): string {
  if (err instanceof DropboxApiError) {
    if (err.status === 401) return "Dropbox tokens nav derīgs.";
    if (err.status === 503 && err.summary === "not_configured") return "Dropbox nav konfigurēts.";
    return `Dropbox ${err.status}${err.summary ? `: ${err.summary.slice(0, 120)}` : ""}`;
  }
  return err instanceof Error ? err.message.slice(0, 160) : "Dropbox kļūda";
}

function verified(entry: DropboxEntry | null): entry is DropboxEntry {
  return Boolean(entry && entry.tag === "file" && entry.size > 0);
}

/** Fails ar šo pavadzīmes numuru mapē vai tās apakšmapēs (`P02813_...pdf`, `P02813.pdf`). */
export function findWaybillFileByNumber(entries: readonly DropboxEntry[], waybillNo: string): DropboxEntry | null {
  const no = waybillNo.trim().toUpperCase();
  if (!no) return null;
  const re = new RegExp(`^${no}(?:[_\\- .].*)?\\.pdf$`, "i");
  return entries.find((e) => e.tag === "file" && re.test(e.name.normalize("NFC")) && e.size > 0) ?? null;
}

export async function saveWaybillPdfToDropbox(
  deps: WaybillDropboxDeps,
  input: { folder: string; fileName: string; waybillNo: string; bytes: Uint8Array | null; attempts?: number },
): Promise<WaybillDropboxSaveResult> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const folder = input.folder.trim().replace(/\/+$/, "");
  const target = `${folder}/${input.fileName}`;
  const attempts = Math.max(1, Math.min(5, input.attempts ?? 3));
  let lastError = "";

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt * attempt);
    try {
      const listed = await deps.client.listAll(folder, { recursive: true, maxPages: 10 });
      const existing = findWaybillFileByNumber(listed.entries, input.waybillNo);
      if (existing) {
        const meta = await deps.client.getMetadata(existing.id || existing.pathDisplay || existing.pathLower);
        if (verified(meta)) return { ok: true, path: meta.pathDisplay || existing.pathDisplay, size: meta.size, reused: true };
      }
      const atTarget = await deps.client.getMetadata(target);
      if (atTarget) {
        // Nekad nepārraksta: tukšs vai mape ar šo vārdu - kļūda adminam.
        if (verified(atTarget)) return { ok: true, path: atTarget.pathDisplay || target, size: atTarget.size, reused: true };
        return { ok: false, error: `Dropbox: ${target} jau ir, bet nav derīgs PDF (netiek pārrakstīts).` };
      }
      if (!input.bytes || input.bytes.byteLength === 0) return { ok: false, error: "PDF nav pieejams augšupielādei." };
      let uploaded: DropboxEntry | null = null;
      try {
        uploaded = await deps.client.upload(target, input.bytes, "add", { autorename: false });
      } catch (err) {
        // Paralēli kāds jau saglabāja - nākamajā mēģinājumā izmantos esošo.
        if (err instanceof DropboxApiError && err.conflict) {
          lastError = "Dropbox: fails jau eksistē (konflikts).";
          continue;
        }
        throw err;
      }
      const meta = await deps.client.getMetadata(uploaded.id || uploaded.pathDisplay || target);
      if (verified(meta)) return { ok: true, path: meta.pathDisplay || uploaded.pathDisplay || target, size: meta.size, reused: false };
      lastError = "Dropbox pārbaude neizdevās (get_metadata: fails nav atrasts vai 0 baitu).";
    } catch (err) {
      lastError = errText(err);
      if (err instanceof DropboxApiError && (err.status === 401 || err.summary === "not_configured")) break;
    }
  }
  return { ok: false, error: lastError || "Dropbox saglabāšana neizdevās." };
}
