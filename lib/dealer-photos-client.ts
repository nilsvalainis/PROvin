/** Dīlera PDF bildes pa porcijām (Vercel atbildes izmēra robeža) - kļūdas gadījumā PDF bez tām bildēm. */
export const DEALER_PHOTOS_BATCH = 6;

export async function loadDealerPhotoDataUrls(
  sessionId: string,
  items: readonly { id: string; blur: boolean }[],
  into: Map<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  for (let i = 0; i < items.length; i += DEALER_PHOTOS_BATCH) {
    const chunk = items.slice(i, i + DEALER_PHOTOS_BATCH);
    try {
      const res = await fetchImpl("/api/admin/dealer-photos/pdf-batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, items: chunk }),
      });
      const data = (await res.json().catch(() => ({}))) as { dataUrls?: Record<string, string> };
      if (!res.ok || !data.dataUrls) continue;
      for (const [id, url] of Object.entries(data.dataUrls)) {
        if (typeof url === "string" && url.startsWith("data:image/")) into.set(id, url);
      }
    } catch {
      /* šī porcija bez bildēm */
    }
  }
}
