"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminWhatsappPrefillParams = {
  templateId: string;
  vin?: string;
  kind?: "audits" | "mini" | "dealer";
  summa?: string;
};

export function adminWhatsappPrefillUrl(params: AdminWhatsappPrefillParams): string {
  const q = new URLSearchParams({ templateId: params.templateId });
  if (params.vin) q.set("vin", params.vin);
  if (params.kind) q.set("kind", params.kind);
  if (params.summa) q.set("summa", params.summa);
  return `/api/admin/message-templates/whatsapp-prefill?${q.toString()}`;
}

export async function fetchAdminWhatsappPrefill(params: AdminWhatsappPrefillParams): Promise<string | null> {
  const res = await fetch(adminWhatsappPrefillUrl(params), { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  return typeof data.text === "string" ? data.text : null;
}

/** Ielādē servera šablonu tekstu admin WhatsApp pogām (ārpus pasūtījuma konteksta). */
export function useAdminWhatsappPrefill(params: AdminWhatsappPrefillParams | null): {
  text: string | null;
  loading: boolean;
} {
  const key = useMemo(() => (params ? JSON.stringify(params) : ""), [params]);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params) {
      setText(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAdminWhatsappPrefill(params).then((t) => {
      if (cancelled) return;
      setText(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key, params]);

  return { text, loading };
}
