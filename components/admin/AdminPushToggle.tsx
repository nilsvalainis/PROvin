"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "needs-install" | "not-configured" | "off" | "on" | "denied" | "busy";

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Lapas reģistrācija (IRISS lietotnē tā jau ir), citādi /admin/sw.js. */
async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
  return navigator.serviceWorker.ready;
}

/**
 * Paziņojumi šajā ierīcē: jauni pasūtījumi, ātrie, termiņi, rīta kopsavilkums.
 * hint: cits paskaidrojums (piem. pavadzīmju lapā - par izrakstītām pavadzīmēm).
 */
export function AdminPushToggle({ hint }: { hint?: string } = {}) {
  const [state, setState] = useState<State>("loading");
  const [publicKey, setPublicKey] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      const res = await fetch("/api/admin/push", { credentials: "include", cache: "no-store" }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { configured?: boolean; publicKey?: string } | null;
      if (!data?.configured || !data.publicKey) {
        setState("not-configured");
        return;
      }
      setPublicKey(data.publicKey);
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setState("busy");
    setNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await pushRegistration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(publicKey) }));
      const res = await fetch("/api/admin/push", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("save");
      setState("on");
      await fetch("/api/admin/push", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true }),
      }).catch(() => undefined);
      setNote("Nosūtīts pārbaudes paziņojums.");
    } catch {
      setState("off");
      setNote("Neizdevās ieslēgt. Mēģini vēlreiz.");
    }
  }

  async function disable() {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/admin/push", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
    setState("off");
    setNote("");
  }

  if (state === "loading" || state === "unsupported") return null;

  const text =
    state === "needs-install"
      ? "Lai saņemtu paziņojumus iPhone: Safari → Kopīgot → Pievienot sākuma ekrānam, tad atver no ikonas."
      : state === "not-configured"
        ? "Paziņojumi serverī vēl nav ieslēgti."
        : state === "denied"
          ? "Paziņojumi ir aizliegti. Ieslēdz tos iPhone Iestatījumos pie šīs lietotnes."
          : hint
            ? hint
            : state === "on"
              ? "Jauni pasūtījumi, ātrie, termiņi un rīta kopsavilkums."
              : "Saņem ziņu par jauniem pasūtījumiem un termiņiem.";

  return (
    <section aria-label="Paziņojumi" className="overflow-hidden rounded-[14px] bg-[var(--surface,#fff)] px-4 py-3 shadow-[var(--am-card-shadow)]">
      <div className="flex min-h-11 items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-[var(--label)]">Paziņojumi šajā ierīcē</span>
          <span className="block text-[13px] leading-snug text-[var(--label-secondary)]">{text}</span>
        </span>
        {state === "off" || state === "on" || state === "busy" ? (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="Paziņojumi šajā ierīcē"
            disabled={state === "busy"}
            onClick={() => void (state === "on" ? disable() : enable())}
            className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              state === "on" ? "bg-[#34c759]" : "bg-[#d1d1d6]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
                state === "on" ? "translate-x-[22px]" : "translate-x-[2px]"
              } left-0`}
            />
          </button>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-[12px] text-[var(--label-secondary)]">{note}</p> : null}
    </section>
  );
}
