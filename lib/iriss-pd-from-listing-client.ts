/**
 * Pārlūka puse: piedāvājums no sludinājuma (Sludinājumi un pasūtījuma Meklētājs izmanto vienu ceļu).
 * Klients: ja auto piesaistīts tieši vienam pasūtījumam - tā klients; citādi tukšs (izvēlas piedāvājumā).
 */

export type IrissPdListingClient = { name: string; phone: string; email: string; orderId: string };

export type IrissPdFromListingResult = { ok: true; id: string } | { ok: false; status: number; message: string };

export function irissPdClientFromOrderBrief(o: { id: string; clientName: string; phone: string; email: string }): IrissPdListingClient {
  return { name: o.clientName.trim(), phone: o.phone.trim(), email: o.email.trim(), orderId: o.id };
}

export async function createIrissPdFromListing(
  listingId: string,
  client: IrissPdListingClient | null,
  fetchImpl: typeof fetch = fetch,
): Promise<IrissPdFromListingResult> {
  try {
    const res = await fetchImpl("/api/admin/iriss-piedavajumi", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ kind: "listing", listingId, ...(client ? { client } : {}) }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: unknown; message?: unknown };
    if (res.ok && data.ok && typeof data.id === "string") return { ok: true, id: data.id };
    return {
      ok: false,
      status: res.status,
      message: typeof data.message === "string" && data.message ? data.message : "Piedāvājumu neizdevās izveidot.",
    };
  } catch {
    return { ok: false, status: 0, message: "Tīkla kļūda - piedāvājums netika izveidots." };
  }
}

export function irissPdHref(id: string): string {
  return `/admin/iriss/piedavajumi/${encodeURIComponent(id)}`;
}

/** Jau izveidotie piedāvājumi šim sludinājumam (no Sludinājumiem vai no tās pašas izsoles saites). */
export function irissPdRowsForListing<T extends { sourceRef: string; source: string; sourceKey: string }>(
  rows: readonly T[],
  v: { id: string; platform: string; externalId: string },
): T[] {
  const ref = `listing:${v.id}`;
  const source = v.platform === "openline" ? "openlane" : v.platform;
  const key = v.externalId.trim().toUpperCase();
  return rows.filter((r) => r.sourceRef === ref || (key !== "" && r.source === source && r.sourceKey.trim().toUpperCase() === key));
}
