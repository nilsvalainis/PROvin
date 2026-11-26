/**
 * Rezultātu kešs pēc VIN (noklusējums 7 dienas): `<dir>/<VIN>.json` (dati + teksts) un `<dir>/<VIN>.pdf`.
 * Ar kešu atkārtots pieprasījums tam pašam VIN neprasa jaunu eParaksts apstiprinājumu un nenoslogo Traficom.
 */
import fs from "node:fs/promises";
import path from "node:path";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function createResultCache({ dir, ttlMs = 7 * 24 * 3_600_000, now = () => Date.now() }) {
  const file = (vin, ext) => path.join(dir, `${vin}.${ext}`);

  async function get(vin) {
    if (!VIN_RE.test(vin)) return null;
    try {
      const meta = JSON.parse(await fs.readFile(file(vin, "json"), "utf8"));
      const at = Date.parse(meta.savedAt ?? "");
      if (!Number.isFinite(at) || now() - at > ttlMs) return null;
      let pdf = null;
      if (meta.hasPdf) pdf = await fs.readFile(file(vin, "pdf")).catch(() => null);
      return { found: Boolean(meta.found), rawText: meta.rawText ?? "", data: meta.data ?? null, pdf, cachedAt: meta.savedAt };
    } catch {
      return null;
    }
  }

  async function set(vin, result) {
    if (!VIN_RE.test(vin)) return;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const savedAt = new Date(now()).toISOString();
    if (result.pdf) await fs.writeFile(file(vin, "pdf"), result.pdf, { mode: 0o600 });
    const meta = { savedAt, found: Boolean(result.found), rawText: result.rawText ?? "", data: result.data ?? null, hasPdf: Boolean(result.pdf) };
    await fs.writeFile(`${file(vin, "json")}.tmp`, JSON.stringify(meta), { mode: 0o600 });
    await fs.rename(`${file(vin, "json")}.tmp`, file(vin, "json"));
  }

  /** Veco ierakstu tīrīšana (izsauc reizi stundā). */
  async function prune() {
    let names = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      return 0;
    }
    let removed = 0;
    for (const name of names.filter((n) => n.endsWith(".json"))) {
      const vin = name.slice(0, -5);
      if (await get(vin)) continue;
      await fs.rm(file(vin, "json"), { force: true });
      await fs.rm(file(vin, "pdf"), { force: true });
      removed++;
    }
    return removed;
  }

  return { get, set, prune };
}
