/**
 * PRO pasūtījuma skata pogu toņi: krāsa tikai nozīmei.
 * - client: ziņa klientam (e-pasts, WhatsApp, nosūtīšana)
 * - money: maksājums / piedāvājums
 * - danger: atmaksa / dzēšana
 * - neutral: viss pārējais
 * Krāsas papildus nostiprina `app/admin/admin-pro-order-theme.css` (admin tēma citādi pārraksta apmales un span krāsu).
 */
export type AdminProTone = "neutral" | "client" | "money" | "danger" | "primary";

export const ADMIN_PRO_BTN_BASE =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45";

export const ADMIN_PRO_TONE: Record<AdminProTone, string> = {
  neutral:
    "provin-tone provin-tone-neutral border border-transparent bg-[rgba(118,118,128,0.12)] text-[#1d1d1f] hover:bg-[rgba(118,118,128,0.2)]",
  client:
    "provin-tone provin-tone-client border border-transparent bg-[rgba(0,113,227,0.10)] text-[#0066cc] hover:bg-[rgba(0,113,227,0.16)]",
  money:
    "provin-tone provin-tone-money border border-transparent bg-[rgba(52,199,89,0.14)] text-[#1f8a3b] hover:bg-[rgba(52,199,89,0.22)]",
  danger:
    "provin-tone provin-tone-danger border border-transparent bg-[rgba(255,59,48,0.10)] text-[#d70015] hover:bg-[rgba(255,59,48,0.16)]",
  primary: "provin-tone provin-tone-primary border border-transparent bg-[#1d1d1f] text-white hover:bg-black",
};

export function adminProBtn(tone: AdminProTone, extra = ""): string {
  return `${ADMIN_PRO_BTN_BASE} ${ADMIN_PRO_TONE[tone]} ${extra}`.trim();
}
