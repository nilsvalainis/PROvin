"use client";

import { Check, Copy, Link2, Loader2, Mail, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminBodyPortal } from "@/components/admin/AdminBodyPortal";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import {
  buildClientLinkWhatsAppText,
  buildClientLinkWhatsAppUrl,
  CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
  CLIENT_LINK_DEFAULT_PRODUCT,
  CLIENT_LINK_DEFAULT_VALIDITY_HOURS,
  CLIENT_LINK_VALIDITY_HOURS,
  defaultClientLinkRequire,
  formatClientLinkAmount,
  formatClientLinkExpiryShort,
  parseEurToCents,
  type ClientLinkRecipientChannel,
  type ClientLinkRequiredFields,
} from "@/lib/client-link";

const darkBtn =
  "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg bg-[#1d1d1f] px-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const fieldLabel = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]";
const inputClass =
  "h-9 w-full rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 text-[13px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:border-[#1d1d1f] focus:bg-white";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function validityLabel(h: number): string {
  if (h === 168) return "7 d";
  return `${h} h`;
}

/** `sheet` - pilna platuma rinda telefona izvēlnē "Darbības" (ar nosaukumu, ne tikai ikona). */
export function AdminClientLinkButton({ variant = "toolbar" }: { variant?: "toolbar" | "sheet" } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useAdminScrollLock(open);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [channel, setChannel] = useState<ClientLinkRecipientChannel>("email");
  const [recipient, setRecipient] = useState("");
  const [productName, setProductName] = useState(CLIENT_LINK_DEFAULT_PRODUCT);
  const [amountText, setAmountText] = useState(formatClientLinkAmount(CLIENT_LINK_DEFAULT_AMOUNT_CENTS).replace(" €", ""));
  const [prefillVin, setPrefillVin] = useState("");
  const [prefillListingUrl, setPrefillListingUrl] = useState("");
  const [require, setRequire] = useState<ClientLinkRequiredFields>(defaultClientLinkRequire);
  const [validityHours, setValidityHours] = useState(CLIENT_LINK_DEFAULT_VALIDITY_HOURS);

  const saveTimer = useRef<number | null>(null);
  const idRef = useRef<string | null>(null);
  const tokenRef = useRef("");

  useEffect(() => {
    idRef.current = id;
  }, [id]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const payload = useCallback(
    () => ({
      recipientChannel: channel,
      recipient,
      productName,
      amountCents: parseEurToCents(amountText) ?? CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
      prefillVin,
      prefillListingUrl,
      require,
      validityHours,
    }),
    [amountText, channel, prefillListingUrl, prefillVin, productName, recipient, require, validityHours],
  );

  const persist = useCallback(async () => {
    const currentId = idRef.current;
    if (!currentId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/client-links", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentId, token: tokenRef.current, ...payload() }),
      });
      const data = (await res.json().catch(() => ({}))) as { expiresAt?: string; error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Neizdevās saglabāt");
        return;
      }
      if (data.expiresAt) setExpiresAt(data.expiresAt);
      setError(null);
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setSaving(false);
    }
  }, [payload]);

  useEffect(() => {
    if (!open || !id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [open, id, persist]);

  const resetForm = () => {
    setId(null);
    setToken("");
    setUrl("");
    setExpiresAt("");
    setChannel("email");
    setRecipient("");
    setProductName(CLIENT_LINK_DEFAULT_PRODUCT);
    setAmountText(formatClientLinkAmount(CLIENT_LINK_DEFAULT_AMOUNT_CENTS).replace(" €", ""));
    setPrefillVin("");
    setPrefillListingUrl("");
    setRequire(defaultClientLinkRequire());
    setValidityHours(CLIENT_LINK_DEFAULT_VALIDITY_HOURS);
    setError(null);
    setCopied(false);
    setEmailNotice(null);
  };

  const openDialog = async () => {
    resetForm();
    setOpen(true);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/client-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientChannel: "email",
          recipient: "",
          productName: CLIENT_LINK_DEFAULT_PRODUCT,
          amountCents: CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
          prefillVin: "",
          prefillListingUrl: "",
          require: defaultClientLinkRequire(),
          validityHours: CLIENT_LINK_DEFAULT_VALIDITY_HOURS,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        token?: string;
        url?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !data.id || !data.token || !data.url) {
        setError(typeof data.error === "string" ? data.error : "Neizdevās izveidot saiti");
        return;
      }
      setId(data.id);
      setToken(data.token);
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
      void persist();
      setOpen(false);
    } catch {
      setError("Neizdevās nokopēt");
    }
  };

  const sendWhatsApp = () => {
    if (!url || !expiresAt) return;
    const text = buildClientLinkWhatsAppText({
      url,
      productName,
      expiresAt,
      amountCents: parseEurToCents(amountText) ?? CLIENT_LINK_DEFAULT_AMOUNT_CENTS,
    });
    const phone = channel === "whatsapp" ? recipient : "";
    window.open(buildClientLinkWhatsAppUrl(phone, text), "_blank", "noopener,noreferrer");
  };

  const sendEmail = async () => {
    if (!id || !token) return;
    const to = channel === "email" ? recipient.trim() : "";
    setEmailNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/client-links/send-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token, to }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_email: "Norādiet derīgu e-pasta adresi.",
          smtp_not_configured: "E-pasts nav iestatīts serverī (SMTP).",
          send_failed: "Neizdevās nosūtīt e-pastu.",
          not_found: "Saite vairs nav derīga.",
        };
        setError(map[data.error ?? ""] ?? "Neizdevās nosūtīt e-pastu");
        return;
      }
      setEmailNotice("E-pasts nosūtīts.");
    } catch {
      setError("Tīkla kļūda");
    } finally {
      setBusy(false);
    }
  };

  const toggleReq = (key: keyof ClientLinkRequiredFields) => {
    setRequire((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {variant === "sheet" ? (
        <button type="button" onClick={() => void openDialog()} className="am-press flex h-[50px] w-full items-center gap-3 rounded-[18px] bg-[var(--fill-secondary)] px-4 text-left text-[16px] text-[var(--label)] disabled:opacity-55">
          <Link2 className="h-5 w-5" strokeWidth={2} aria-hidden />
          Jauna klienta saite
        </button>
      ) : (
        <button type="button" onClick={() => void openDialog()} className={darkBtn} title="Jauna klienta saite" aria-label="Jauna klienta saite">
          <Link2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          <span className="hidden lg:inline">Jauna klienta saite</span>
          <span className="hidden sm:inline lg:hidden">Klienta saite</span>
        </button>
      )}

      {open ? (
        <AdminBodyPortal>
        <div
          className="fixed inset-0 z-[50] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="presentation"
          onClick={() => {
            void persist();
            setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-link-title"
            className="max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
            <h2 id="client-link-title" className="text-[18px] font-semibold tracking-tight text-[#1d1d1f]">
              Jauna klienta saite
            </h2>
            <button
              type="button"
              aria-label="Aizvērt"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f2f7] text-[#1d1d1f]"
              onClick={() => {
                void persist();
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
              Sūtīt jebkuram - pasūtījums tiek izveidots tikai tad, kad klients aizpilda formu un samaksā.
            </p>

            <p className={`${fieldLabel} mt-4`}>Saņēmējs</p>
            <div className="mb-2 inline-flex rounded-lg bg-[#f2f2f7] p-0.5">
              {(["email", "whatsapp"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
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
              onChange={(e) => setRecipient(e.target.value)}
            />

            <p className={`${fieldLabel} mt-4`}>Produkts un summa</p>
            <div className="grid grid-cols-[1fr_7.5rem] gap-2">
              <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} />
              <input
                className={inputClass}
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => {
                  const cents = parseEurToCents(amountText);
                  if (cents != null) setAmountText(formatClientLinkAmount(cents).replace(" €", ""));
                }}
              />
            </div>

            <p className={`${fieldLabel} mt-4`}>Aizpildīts iepriekš (neobligāti)</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="VIN" value={prefillVin} onChange={(e) => setPrefillVin(e.target.value)} />
              <input
                className={inputClass}
                placeholder="Sludinājuma saite"
                value={prefillListingUrl}
                onChange={(e) => setPrefillListingUrl(e.target.value)}
              />
            </div>

            <p className={`${fieldLabel} mt-4`}>Klientam jāaizpilda</p>
            <div className="flex flex-col gap-1.5 text-[13px] text-[#1d1d1f]">
              {(
                [
                  ["email", "E-pasts"],
                  ["vin", "VIN"],
                  ["listingUrl", "Sludinājuma saite"],
                  ["phone", "Tālrunis"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#d2d2d7]"
                    checked={require[key]}
                    onChange={() => toggleReq(key)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <p className={`${fieldLabel} mt-4`}>Derīgums</p>
            <select
              className={`${inputClass} max-w-[8rem]`}
              value={validityHours}
              onChange={(e) => setValidityHours(Number(e.target.value))}
            >
              {CLIENT_LINK_VALIDITY_HOURS.map((h) => (
                <option key={h} value={h}>
                  {validityLabel(h)}
                </option>
              ))}
            </select>

            <p className={`${fieldLabel} mt-4`}>Saite</p>
            <div className="flex gap-2">
              <input className={inputClass} readOnly value={url} placeholder="Ģenerē…" />
            </div>

            {expiresAt ? (
              <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] leading-snug text-emerald-800">
                <p>Unikāla, neuzminama, vienreizēja - derīga līdz {formatClientLinkExpiryShort(expiresAt)}</p>
                <p className="mt-0.5 text-emerald-700/80">Nav redzama mājaslapā, nav indeksēta.</p>
              </div>
            ) : null}

            {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
            {emailNotice ? <p className="mt-2 text-[12px] text-emerald-700">{emailNotice}</p> : null}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void persist();
                  setOpen(false);
                }}
                className="h-9 rounded-full border border-[#d2d2d7] bg-white px-3.5 text-[13px] font-medium text-[#1d1d1f]"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void copyLink()}
                disabled={!url}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#d2d2d7] bg-white px-3.5 text-[13px] font-medium text-[#1d1d1f] disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Kopēt saiti
              </button>
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={!url}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#20BD5A] hover:brightness-105 disabled:opacity-50"
              >
                <WhatsAppGlyph className="h-3.5 w-3.5" />
                Sūtīt WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void sendEmail()}
                disabled={!url || busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#5b7cfa] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Sūtīt e-pastā
              </button>
            </div>
            {saving ? <p className="mt-2 text-right text-[11px] text-[#aeaeb2]">Saglabā…</p> : null}
          </div>
        </div>
        </AdminBodyPortal>
      ) : null}
    </>
  );
}
