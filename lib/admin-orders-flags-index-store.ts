import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  parseOrderFlagsIndex,
  withoutOrderFlagEntry,
  type OrderFlagsIndexDoc,
} from "@/lib/admin-orders-flags-index-core";

/** {dir|blobPrefix}/orders_flags_index/v1.json — kešs; drīkst pazust vai būt novecojis. */
const REL = "orders_flags_index/v1.json";

function enabled(): { blob: ReturnType<typeof getOrderDraftBlobConfig>; dir: string | null } | null {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) return { blob, dir };
  if (dir && process.env.VERCEL !== "1") return { blob: null, dir };
  return null;
}

export async function readOrderFlagsIndex(): Promise<OrderFlagsIndexDoc | null> {
  const st = enabled();
  if (!st) return null;
  try {
    if (st.blob) {
      const res = await get(`${st.blob.prefix}${REL}`, { access: "private", token: st.blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseOrderFlagsIndex(JSON.parse(await new Response(res.stream).text()));
      return null;
    }
    return parseOrderFlagsIndex(JSON.parse(await fs.readFile(path.join(st.dir!, REL), "utf8")));
  } catch {
    return null;
  }
}

export async function writeOrderFlagsIndex(doc: OrderFlagsIndexDoc): Promise<void> {
  const st = enabled();
  if (!st) return;
  const body = JSON.stringify(doc);
  try {
    if (st.blob) {
      await put(`${st.blob.prefix}${REL}`, body, {
        access: "private",
        token: st.blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    } else {
      const fp = path.join(st.dir!, REL);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, body, "utf8");
    }
  } catch (e) {
    console.warn("[orders-flags-index] write failed", e instanceof Error ? e.message : e);
  }
}

/** Pēc „Izpildīts” / krāsas / upsell maiņas: atjauno ierakstu uz vietas no avota (ar `at`), lai fona raksts ar vecāku nolasījumu to nepārrakstītu. */
export async function invalidateOrderFlags(sessionId: string): Promise<void> {
  try {
    const { refreshOrderFlagEntry } = await import("@/lib/admin-orders-flags");
    await refreshOrderFlagEntry(sessionId);
  } catch {
    try {
      const doc = await readOrderFlagsIndex();
      if (doc?.entries[sessionId]) await writeOrderFlagsIndex(withoutOrderFlagEntry(doc, sessionId));
    } catch {
      /* kešs — nav kritiski */
    }
  }
}
