import Link from "next/link";
import { IrissListingPlatformChipsInline } from "@/components/admin/IrissListingPlatformChipsInline";
import { IrissPasutijumiNewFab } from "@/components/admin/IrissPasutijumiNewFab";
import {
  buildListingPlatformChips,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import { getIrissPasutijumiStorageState, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export const dynamic = "force-dynamic";

const BRAND_ICON_SLUGS: Record<string, string> = {
  volkswagen: "volkswagen",
  vw: "volkswagen",
  audi: "audi",
  bmw: "bmw",
  mercedes: "mercedes",
  "mercedes-benz": "mercedes",
  toyota: "toyota",
  skoda: "skoda",
  ford: "ford",
  volvo: "volvo",
  kia: "kia",
  hyundai: "hyundai",
  nissan: "nissan",
  peugeot: "peugeot",
  renault: "renault",
  opel: "opel",
  tesla: "tesla",
};

function getBrandToken(brandModel: string): string {
  return brandModel
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function getBrandLogoUrl(brandModel: string): string | null {
  const token = getBrandToken(brandModel);
  if (!token) return null;
  const slug = BRAND_ICON_SLUGS[token];
  if (!slug) return null;
  return `https://cdn.simpleicons.org/${slug}/111827`;
}

function getBrandFallbackLabel(brandModel: string): string {
  const token = getBrandToken(brandModel).toUpperCase();
  if (!token) return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}

export default async function IrissPasutijumiListPage() {
  const storage = getIrissPasutijumiStorageState();
  const storeEnabled = storage.enabled;
  const rows = storeEnabled ? await listIrissPasutijumi() : [];

  return (
    <div className="relative w-full max-w-none pb-24 sm:pb-8">
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3.5 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-amber-900/90">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam
              mainīgo{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
              (Storage → Blob → savienot ar projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
            </p>
          ) : (
            <p className="mt-1.5 text-amber-900/90">
              Iestatiet mapes ceļu vai noņemiet atspējošanu:{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>{" "}
              (lokāli noklusējums: <span className="font-mono">.data/iriss-pasutijumi</span> projekta saknē).
            </p>
          )}
        </div>
      ) : null}

      {storeEnabled && rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav pasūtījumu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">Spied „+”, lai izveidotu pirmo ierakstu.</p>
        </div>
      ) : null}

      {storeEnabled && rows.length > 0 ? (
        <ul className="mt-3 space-y-2.5 sm:space-y-3">
          {rows.map((r) => {
            const chips = buildListingPlatformChips(
              {
                listingLinkMobile: r.listingLinkMobile,
                listingLinkAutobid: r.listingLinkAutobid,
                listingLinkOpenline: r.listingLinkOpenline,
                listingLinkAuto1: r.listingLinkAuto1,
                listingLinksOther: r.listingLinksOther,
              },
              5,
            );
            const brandLogoUrl = getBrandLogoUrl(r.brandModel);
            const brandFallback = getBrandFallbackLabel(r.brandModel);

            return (
            <li key={r.id}>
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:border-slate-300/90">
                <div className="flex items-stretch">
                  <Link
                    href={`/admin/iriss/pasutijumi/${encodeURIComponent(r.id)}`}
                    aria-label={`Atvērt pasūtījumu: ${r.brandModel}`}
                    className="flex min-w-0 flex-1 flex-row items-center gap-2.5 p-3 outline-none ring-[var(--color-provin-accent)]/30 transition hover:bg-slate-50/50 active:bg-slate-100/60 focus-visible:ring-2 sm:gap-3 sm:p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {brandLogoUrl ? (
                          <img
                            src={brandLogoUrl}
                            alt={`${brandFallback} logo`}
                            loading="lazy"
                            className="h-5 w-5 shrink-0 rounded-sm border border-slate-200/90 bg-white p-[2px] sm:h-6 sm:w-6"
                          />
                        ) : (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-slate-200/90 bg-slate-50 text-[9px] font-bold text-slate-600 sm:h-6 sm:w-6 sm:text-[10px]">
                            {brandFallback}
                          </span>
                        )}
                        <p className="truncate text-[14px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[15px]">
                          {r.brandModel}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-provin-muted)] sm:text-[13px]">
                        <span>
                          <span className="font-medium text-[var(--color-apple-text)]">Budžets:</span> {r.totalBudget}
                        </span>
                        <span>
                          <span className="font-medium text-[var(--color-apple-text)]">Tālrunis:</span> {r.phone}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 self-center rounded-full bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm sm:px-3 sm:py-1.5 sm:text-[12px]">
                      Atvērt
                    </span>
                  </Link>
                  {chips.length > 0 ? (
                    <div className="hidden items-center border-l border-slate-100/90 px-2 md:flex lg:px-3">
                      <div role="group" aria-label="Sludinājumu platformu saites" className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}>
                        {chips.map((c, i) => (
                          <a
                            key={`${c.href}-${i}`}
                            href={c.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={c.title}
                            className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} ${c.chipClass}`}
                          >
                            {c.letter}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {chips.length > 0 ? (
                  <div className="md:hidden">
                    <IrissListingPlatformChipsInline
                      links={{
                        listingLinkMobile: r.listingLinkMobile,
                        listingLinkAutobid: r.listingLinkAutobid,
                        listingLinkOpenline: r.listingLinkOpenline,
                        listingLinkAuto1: r.listingLinkAuto1,
                        listingLinksOther: r.listingLinksOther,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
      ) : null}

      {storeEnabled ? <IrissPasutijumiNewFab /> : null}
    </div>
  );
}
