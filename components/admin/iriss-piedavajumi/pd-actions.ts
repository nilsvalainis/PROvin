"use client";

import { useState } from "react";
import type { useRouter } from "next/navigation";
import { irissPdPublicPath } from "@/lib/iriss-piedavajumi-types";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function irissPdAbsoluteLink(token: string): string {
  return `${window.location.origin}${irissPdPublicPath(token)}`;
}

/** «Kopēt saiti» sarakstā: saite ir tikai ierakstā, tāpēc to nolasa pēc pieprasījuma. */
export function usePdCopyLink() {
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");
  async function copy(id: string) {
    setCopyError("");
    try {
      const res = await fetch(`/api/admin/iriss-piedavajumi/${id}`, { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { record?: { linkToken?: string } };
      const token = data.record?.linkToken ?? "";
      if (!token) throw new Error("no_token");
      if (!(await copyText(irissPdAbsoluteLink(token)))) throw new Error("clipboard");
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? "" : c)), 2500);
    } catch {
      setCopyError("Neizdevās nokopēt saiti.");
    }
  }
  return { copy, copiedId, copyError };
}

/** «Izveidot jaunu uz šī bāzes». */
export function usePdRebase() {
  const [rebaseBusy, setBusy] = useState(false);
  const [rebaseError, setError] = useState("");
  async function rebase(baseId: string, router: ReturnType<typeof useRouter>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/iriss-piedavajumi", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "rebase", baseId }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; message?: string };
      if (!data.ok || !data.id) throw new Error(data.message || "Neizdevās izveidot jaunu piedāvājumu.");
      router.push(`/admin/iriss/piedavajumi/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neizdevās izveidot jaunu piedāvājumu.");
      setBusy(false);
    }
  }
  return { rebase, rebaseBusy, rebaseError };
}
