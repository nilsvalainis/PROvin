"use client";

import { Briefcase, Check, Copy, Loader2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { buildClientLinkWhatsAppUrl, CLIENT_LINK_VALIDITY_HOURS, formatClientLinkExpiryShort } from "@/lib/client-link";
import {
  BUSINESS_LINK_DEFAULT_VALIDITY_HOURS,
  BUSINESS_LINK_PRODUCT_NAME,
  buildBusinessLinkWhatsAppText,
  formatBusinessLinkAmount,
  type BusinessLinkRecipientChannel,
} from "@/lib/business-link";

const darkBtn =
  "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg bg-[#1d1d1f] px-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const fieldLabel = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]";
const inputClass =
  "h-9 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:border-[#1d1d1f] focus:bg-white";

const errorText: Record<string, string> = {
  invalid_vin: "VIN nav derīgs.",
  invalid_validity: "Nederīgs derīguma termiņš.",
  store_failed: "Neizdevās saglabāt saiti.",
  unauthorized: "Nepieciešama pieteikšanās.",
};

function validityLabel(h: number): string {
  return h === 168 ? "7 d" : `${h} h`;
}

/** PROVIN Business 69,99 € unikālā saite (`/b/[token]`). Summa fiksēta serverī. */
export function AdminBusinessLinkButton({ variant = "toolbar" }: { variant?: "toolbar" | "sheet" } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useAdminScrollLock(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [channel, setChannel] = useState<BusinessLinkRecipientChannel>("email");
  const [recipient, setRecipient] = useState("");
  const [prefillVin, setPrefillVin] = useState("");
  const [validityHours, setValidityHours] = useState(BUSINESS_LINK_DEFAULT_VALIDITY_HOURS);
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const openDialog = () => {
    setChannel("email");
    setRecipient("");
    setPrefillVin("");
    setValidityHours(BUSINESS_LINK_DEFAULT_VALIDITY_HOURS);
    setUrl("");
    setExpiresAt("");
    setError(null);
    setCopied(false);
    setOpen(true);
  };

  const closeDialog = useCallback(() => setOpen(false), []);
  const backdropClose = useModalBackdropClose(closeDialog);

  const createLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientChannel: channel, recipient, prefillVin, validityHours }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(errorText[data.error ?? ""] ?? "Neizdevās izveidot saiti");
        return;
      }
      setUrl(data.url);
      setExpiresAt(data.expiresAt ?? "");
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Neizdevās nokopēt");
    }
  };

  const sendWhatsApp = () => {
    if (!url || !expiresAt) return;
    const text = buildBusinessLinkWhatsAppText({ url, expiresAt });
    window.open(buildClientLinkWhatsAppUrl(channel === "whatsapp" ? recipient : "", text), "_blank", "noopener,noreferrer");
  };

  const created = Boolean(url);

  return (
    <>
      {variant === "sheet" ? (
        <button
          type="button"
          onClick={openDialog}
          className="am-press flex h-[50px] w-full items-center gap-3 rounded-[18px] bg-[var(--fill-secondary)] px-4 text-left text-[16px] text-[var(--label)]"
        >
          <Briefcase className="h-5 w-5" strokeWidth={2} aria-hidden />
          Jauna Business saite
        </button>
      ) : (
        <button type="button" onClick={openDialog} className={darkBtn} title="Jauna Business saite" aria-label="Jauna Business saite">
          <Briefcase className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          <span className="hidden lg:inline">Business saite</span>
        </button>
      )}

      {open ? (
        <AdminBodyPortal>
          <div
            className="fixed inset-0 z-[50] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
            role="presentation"
            {...backdropClose}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="business-link-title"
              className="max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="business-link-title" className="text-[18px] font-semibold tracking-tight text-[#1d1d1f]">
                  Jauna Business saite
                </h2>
                <button
                  type="button"
                  aria-label="Aizvērt"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f2f7] text-[#1d1d1f]"
                  onClick={closeDialog}
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
                {BUSINESS_LINK_PRODUCT_NAME} par {formatBusinessLinkAmount()} - summa ir fiksēta. Pasūtījums tiek izveidots tikai pēc apmaksas.
              </p>

              <p className={`${fieldLabel} mt-4`}>Saņēmējs (neobligāti)</p>
              <div className="mb-2 inline-flex rounded-lg bg-[#f2f2f7] p-0.5">
                {(["email", "whatsapp"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={created}
                    onClick={() => setChannel(c)}
                    className={`rounded-md px-3 py-1 text-[12.5px] font-medium ${channel === c ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]"}`}
                  >
                    {c === "email" ? "E-pasts" : "WhatsApp"}
                  </button>
                ))}
              </div>
              <input
                className={inputClass}
                type={channel === "email" ? "email" : "tel"}
                placeholder={channel === "email" ? "klients@piemers.lv" : "+371 ..."}
                value={recipient}
                readOnly={created}
                onChange={(e) => setRecipient(e.target.value)}
              />

              <p className={`${fieldLabel} mt-4`}>VIN (neobligāti)</p>
              <input
                className={inputClass}
                placeholder="VIN"
                value={prefillVin}
                readOnly={created}
                onChange={(e) => setPrefillVin(e.target.value)}
              />

              <p className={`${fieldLabel} mt-4`}>Derīgums</p>
              <select
                className={`${inputClass} max-w-[8rem]`}
                value={validityHours}
                disabled={created}
                onChange={(e) => setValidityHours(Number(e.target.value))}
              >
                {CLIENT_LINK_VALIDITY_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {validityLabel(h)}
                  </option>
                ))}
              </select>

              {created ? (
                <>
                  <p className={`${fieldLabel} mt-4`}>Saite</p>
                  <input className={inputClass} readOnly value={url} />
                  {expiresAt ? (
                    <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] leading-snug text-emerald-800">
                      <p>Unikāla, neuzminama, vienreizēja - derīga līdz {formatClientLinkExpiryShort(expiresAt)}</p>
                      <p className="mt-0.5 text-emerald-700/80">Nav redzama mājaslapā, nav indeksēta.</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-9 rounded-full border border-[#d2d2d7] bg-white px-3.5 text-[13px] font-medium text-[#1d1d1f]"
                >
                  {created ? "Aizvērt" : "Atcelt"}
                </button>
                {created ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#d2d2d7] bg-white px-3.5 text-[13px] font-medium text-[#1d1d1f]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Kopēt saiti
                    </button>
                    <button
                      type="button"
                      onClick={sendWhatsApp}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#20BD5A]"
                    >
                      Sūtīt WhatsApp
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void createLink()}
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1d1d1f] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Izveidot saiti
                  </button>
                )}
              </div>
            </div>
          </div>
        </AdminBodyPortal>
      ) : null}
    </>
  );
}
