"use client";

import { useEffect, useState } from "react";

type Health = {
  ok?: boolean;
  durable?: boolean;
  durableConfigured?: boolean;
  backend?: string;
  blob?: { configured?: boolean; canWrite?: boolean; canRead?: boolean; error?: string | null };
  checkedAt?: string;
};

type Props = {
  /** SSR: vai env norāda uz ilgtermiņa glabātuvi. */
  durableConfigured: boolean;
};

const HEALTH_SESSION_KEY = "provin.persistence.health.v1";
const HEALTH_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readCachedHealth(): Health | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HEALTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; health?: Health };
    if (!parsed?.health || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > HEALTH_CACHE_MAX_AGE_MS) return null;
    if (parsed.health.ok !== true || parsed.health.durable !== true) return null;
    return parsed.health;
  } catch {
    return null;
  }
}

function writeCachedHealth(health: Health): void {
  if (typeof window === "undefined") return;
  if (health.ok !== true || health.durable !== true) return;
  try {
    sessionStorage.setItem(HEALTH_SESSION_KEY, JSON.stringify({ at: Date.now(), health }));
  } catch {
    /* quota */
  }
}

/** Runtime Blob/FS pārbaude — nevis tikai env flags. */
export function AdminPersistenceHealthBanner({ durableConfigured }: Props) {
  const [health, setHealth] = useState<Health | null>(() =>
    durableConfigured ? readCachedHealth() : null,
  );
  const [loading, setLoading] = useState(durableConfigured && !readCachedHealth());

  useEffect(() => {
    if (!durableConfigured) {
      setLoading(false);
      return;
    }
    const cached = readCachedHealth();
    if (cached) {
      setHealth(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetch("/api/admin/debug/persistence", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: Health) => {
        if (!cancelled) {
          setHealth(data);
          writeCachedHealth(data);
        }
      })
      .catch(() => {
        if (!cancelled) setHealth({ ok: false, durable: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [durableConfigured]);

  if (!durableConfigured) {
    return (
      <p
        className="mx-auto mb-3 max-w-2xl rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-amber-950"
        role="alert"
      >
        Servera melnraksts nav ilgtermiņa — dati pazudīs pēc refresh/deploy. Vercel Production: iestati{" "}
        <code className="font-mono text-[10px]">ADMIN_ORDER_DRAFT_BLOB_PREFIX=admin-order-drafts/</code> un{" "}
        <code className="font-mono text-[10px]">BLOB_READ_WRITE_TOKEN</code>, pēc tam <strong>Redeploy</strong>.
      </p>
    );
  }

  if (loading) return null;

  if (health?.ok && health.durable) {
    return (
      <p
        className="mx-auto mb-3 max-w-2xl rounded-lg border border-emerald-600/25 bg-emerald-50/80 px-3 py-1.5 text-center text-[10px] font-medium text-emerald-900"
        role="status"
      >
        Servera melnraksts: {health.backend ?? "blob"} — saglabāšana aktīva
        {health.blob?.canWrite && health.blob?.canRead ? " (read/write OK)" : ""}.
      </p>
    );
  }

  const blobErr = health?.blob?.error?.trim();
  return (
    <p
      className="mx-auto mb-3 max-w-2xl rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-red-950"
      role="alert"
    >
      Servera melnraksts nav pieejams — imports netiks saglabāts.
      {blobErr ? ` ${blobErr}` : " Pārbaudi Vercel env un veic Redeploy."}{" "}
      <a href="/api/admin/debug/persistence" className="underline" target="_blank" rel="noreferrer">
        Diagnostika
      </a>
    </p>
  );
}
