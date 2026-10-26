"use client";

import { useCallback, useEffect, useState } from "react";
import { IrissSaitesSection } from "@/components/admin/iriss-saites/IrissSaitesSection";
import "./iriss-saites.css";
import {
  buildIrissCarShareMessage,
  buildIrissCarShareWhatsAppUrl,
  type IrissSaitesView,
} from "@/lib/iriss-car-share";

type From = "autoparks" | "logistics";

function apiPath(from: From, id: string): string {
  if (from === "autoparks") {
    return `/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(id)}/saite`;
  }
  return `/api/admin/iriss-logistics/orders/${encodeURIComponent(id)}/saite`;
}

export function IrissSaitesPanel({ from, id, vehicle = "" }: { from: From; id: string; vehicle?: string }) {
  const [view, setView] = useState<IrissSaitesView | null>(null);
  const [title, setTitle] = useState(vehicle);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    void fetch(apiPath(from, id), { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { view?: IrissSaitesView; vehicle?: string } | null) => {
        if (off || !body?.view) return;
        setView(body.view);
        if (body.vehicle) setTitle(body.vehicle);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [from, id]);

  const copyUrl = useCallback(() => {
    if (!view?.share) return;
    const url = `${window.location.origin}${view.share.path}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  }, [view]);

  const openWhatsApp = useCallback(() => {
    if (!view?.share) return;
    const url = `${window.location.origin}${view.share.path}`;
    const text = buildIrissCarShareMessage({ url, vehicle: title });
    const href = buildIrissCarShareWhatsAppUrl(view.phone, text);
    window.open(href, "_blank", "noopener,noreferrer");
    setBusy(true);
    void fetch(apiPath(from, id), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sent" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { view?: IrissSaitesView } | null) => {
        if (body?.view) setView(body.view);
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }, [from, id, title, view]);

  if (!view) return null;
  return <IrissSaitesSection view={view} copied={copied} busy={busy} onCopy={copyUrl} onWhatsApp={openWhatsApp} />;
}
