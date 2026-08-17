"use client";

import {
  VIN_AUTOFILL_SERVICES,
  buildVinAutofillHref,
  normalizeVinForServiceUrls,
  vinAutofillServiceHomeUrl,
  type VinAutofillService,
} from "@/lib/admin-vin-urls";

const linkPill =
  "inline-flex h-8 min-w-[2.85rem] items-center justify-center rounded-xl border border-white/20 bg-white/55 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-xl transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 focus-visible:ring-offset-1";

const headerPill =
  "inline-flex h-8 min-w-[2.6rem] items-center justify-center rounded-lg border border-black/25 bg-white/80 px-2 text-[10px] font-semibold uppercase tracking-wide text-black shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30";

function serviceTitle(svc: VinAutofillService): string {
  if (svc.key === "autodna") return "AutoDNA — autodna.lv /vin/{VIN} + Tampermonkey";
  if (svc.key === "carvertical") return "CarVertical — Manas atskaites + Tampermonkey aizpilda VIN";
  if (svc.key === "auto_records") return "Auto-Records — ?vin= + Tampermonkey";
  if (svc.key === "carinfo") return "car.info — meklēšana ar VIN + Tampermonkey; ielīmē lapas tekstu RAW laukā";
  return "CheckThisReg — VIN cilne + Tampermonkey aizpilda VIN";
}

function VinServiceAnchor({
  svc,
  vin,
  className,
}: {
  svc: VinAutofillService;
  vin: string;
  className: string;
}) {
  const href = buildVinAutofillHref(svc.key, vin);
  const handoff = normalizeVinForServiceUrls(vin);
  if (!href) {
    return (
      <span className={`${className} cursor-not-allowed opacity-50`} title="Ievadi VIN">
        {svc.shortLabel}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={serviceTitle(svc)}
      data-provin-handoff-vin={svc.handoffVin ? handoff : undefined}
    >
      {svc.shortLabel}
    </a>
  );
}

/** Zem VIN ievades lauka — DNA / CV / AR / CTR. */
export function AdminVinServiceLinkRow({ vin }: { vin: string }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {VIN_AUTOFILL_SERVICES.map((svc) => (
        <VinServiceAnchor key={svc.key} svc={svc} vin={vin} className={linkPill} />
      ))}
    </div>
  );
}

/** Sticky MENU josla admin galvenē — vienmēr pieejama ar VIN auto-aizpildi. */
export function AdminVinSourcesMenuBar({ vin }: { vin: string }) {
  const hasVin = Boolean(normalizeVinForServiceUrls(vin));
  return (
    <nav
      className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-black/20 px-3 py-1.5 sm:px-4"
      aria-label="VIN avotu MENU"
    >
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-black/70">Menu</span>
      {VIN_AUTOFILL_SERVICES.map((svc) =>
        hasVin ? (
          <VinServiceAnchor key={svc.key} svc={svc} vin={vin} className={headerPill} />
        ) : (
          <a
            key={svc.key}
            href={vinAutofillServiceHomeUrl(svc.key)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${headerPill} opacity-70`}
            title={`${svc.title} — bez VIN (nav auto-aizpildes)`}
          >
            {svc.shortLabel}
          </a>
        ),
      )}
    </nav>
  );
}
