"use client";

import { Info, Lock } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatClientLinkAmount } from "@/lib/client-link";
import type { BusinessLinkCar } from "@/lib/business-link";
import { LegalReveal } from "@/components/LegalReveal";
import { followStripeCheckoutUrl, trackMetaLead } from "@/lib/meta-pixel";
import { isValidVin } from "@/lib/order-field-validation";

/** Apstiprinātais dizains: docs/makets-business-poga/GALA-lapa.md (V4). */

export type BusinessPartnerPageView = {
  amountCents: number;
  vin: string;
  car: BusinessLinkCar;
  partnerName: string;
  partnerLogoOnDarkUrl: string;
  /** Pakalpojuma sniedzēja rekvizīti (paslēpti zem «PROVIN»). */
  legalLine: string;
};

const SERVICES: ReadonlyArray<readonly [string, string]> = [
  ["Oficiālo dīleru servisa dati*", "Detalizēti nobraukuma, apkopju intervālu un remontu dati."],
  ["Maksas vēstures atskaites", "carVertical, autoDNA u.c. vienā atskaitē - avoti papildina cits citu."],
  ["Oficiālie valstu reģistri", "Vēsturi pārbaudām arī ES valstu oficiālajos reģistros. Citi reģioni - pēc pieprasījuma."],
  ["Eiropas izsoļu portālu arhīvi*", "Ieraksti un foto no brīža, kad auto bija bojāts vai pārdots izsolē."],
  ["Latvijas avoti", "Apdrošinātāju dati, sludinājuma un tehnisko apskašu vēsture."],
];

const FIELD_ERROR: Record<string, string> = {
  email: "Lūdzu, ievadiet derīgu e-pastu.",
  phone: "Lūdzu, ievadiet tālruņa numuru ar vismaz 8 cipariem.",
  consent: "Lai turpinātu uz apmaksu, atzīmējiet apstiprinājumu.",
  vin_locked: "Šī saite ir paredzēta tikai norādītajam auto.",
  rate_limited: "Pārāk daudz pieprasījumu. Uzgaidiet īsu brīdi un mēģiniet vēlreiz.",
  not_found: "Saite vairs nav derīga. Atveriet auto sludinājumu un spiediet PROVIN pogu vēlreiz.",
  stripe_config: "Apmaksa šobrīd nav pieejama. Mēģiniet vēlāk.",
  session_failed: "Neizdevās sagatavot apmaksu. Mēģiniet vēlreiz.",
  network: "Tīkla kļūda. Mēģiniet vēlreiz.",
};

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-[-0.035em] ${className}`}>
      PRO<span className="text-[#5c9dff]">VIN</span>
    </span>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#5c9dff] lg:h-[18px] lg:w-[18px]">
      <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Services({ className }: { className: string }) {
  return (
    <div className={className}>
      <ul className="mt-3 lg:mt-6">
        {SERVICES.map(([title, desc]) => (
          <li key={title} className="flex gap-2.5 border-t border-white/[0.08] py-[9px] lg:gap-3 lg:py-[11px]">
            <Check />
            <div>
              <p className="text-[14px] font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[#a1a1aa] lg:mt-[3px] lg:text-[13px]">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] leading-normal text-[#71717a] lg:mt-3.5 lg:text-[12px]">
        * Dīleru un izsoļu dati pieejami noteiktiem ražotājiem un modeļiem. Vecākiem auto dīlera datu var nebūt.
      </p>
    </div>
  );
}

function carMeta(car: BusinessLinkCar): string {
  const km = car.mileageKm ? `${Number(car.mileageKm).toLocaleString("lv-LV").replace(/ /g, " ")} km` : "";
  return [car.year, km, car.fuel, car.gearbox].filter(Boolean).join(" · ");
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="mt-2.5 block lg:mt-3.5">
      <span className="text-[13px] font-semibold">
        {label}
        {optional ? <span className="font-normal opacity-60"> (neobligāti)</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "mt-[5px] h-11 w-full rounded-xl border border-white/[0.12] bg-black/35 px-3.5 text-[16px] text-white outline-none placeholder:text-[#52525b] focus:border-[#5c9dff] lg:mt-[7px] lg:h-12 lg:border-[#e5e5ea] lg:bg-white lg:text-[#1d1d1f] lg:placeholder:text-[#aeaeb2] lg:focus:border-[#1d1d1f]";

export function BusinessPartnerLinkPage({ token, view }: { token: string; view: BusinessPartnerPageView }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyReg, setCompanyReg] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = formatClientLinkAmount(view.amountCents);
  const meta = carMeta(view.car);
  const hasVin = isValidVin(view.vin);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      trackMetaLead();
      const res = await fetch("/api/business-link/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          vin: view.vin,
          listingUrl: "",
          phone,
          companyName,
          companyReg,
          companyAddress,
          withdrawalConsent: consent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; eventId?: string; value?: number; error?: string };
      if (!res.ok || !followStripeCheckoutUrl(data)) {
        setError(FIELD_ERROR[data.error ?? ""] ?? FIELD_ERROR.session_failed);
      }
    } catch {
      setError(FIELD_ERROR.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#17181c_0%,#09090b_420px)] font-[family-name:var(--font-inter)] text-[#f4f4f5] antialiased lg:grid lg:grid-cols-2 lg:bg-none">
      {/* Kreisā puse: partneris, produkts, auto (datorā arī pakalpojumi) */}
      <section className="relative overflow-hidden px-4 pt-4 lg:flex lg:items-center lg:justify-end lg:bg-[#09090b] lg:px-14 lg:py-10">
        {view.car.imageUrl ? (
          <>
            <div
              aria-hidden
              className="absolute -inset-[60px] hidden scale-110 bg-cover bg-center opacity-[0.38] blur-[48px] saturate-[.6] lg:block"
              style={{ backgroundImage: `url(${JSON.stringify(view.car.imageUrl)})` }}
            />
            <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(9,9,11,.55),rgba(9,9,11,.85))] lg:block" />
          </>
        ) : null}
        <div className="relative w-full lg:max-w-[500px]">
          <div className="flex flex-col items-start gap-2 lg:gap-2.5">
            {view.partnerLogoOnDarkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.partnerLogoOnDarkUrl} alt={view.partnerName} className="h-[22px] w-auto lg:h-[30px]" referrerPolicy="no-referrer" />
            ) : view.partnerName ? (
              <p className="text-[19px] font-bold tracking-tight lg:text-[22px]">{view.partnerName}</p>
            ) : null}
            <p className="flex items-center gap-2 text-[12px] text-[#a1a1aa]">
              Auto vēstures pārbaude sadarbībā ar <Wordmark className="text-[14px] text-white" />
            </p>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5c9dff] lg:mt-10 lg:text-[12px]">
            PROVIN Business datu atskaite
          </p>
          <h1 className="mt-1.5 text-[20px] font-extrabold leading-[1.15] tracking-[-0.03em] lg:mt-2.5 lg:text-[26px]">
            Pilna auto vēstures pārbaude dažādos avotos
          </h1>

          <div className={`mt-3.5 grid items-start gap-3 lg:mt-[26px] lg:items-center lg:gap-[18px] ${view.car.imageUrl ? "grid-cols-[112px_1fr] lg:grid-cols-[200px_1fr]" : ""}`}>
            {view.car.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.car.imageUrl}
                alt=""
                className="h-20 w-full rounded-[10px] border border-white/10 object-cover lg:h-[134px] lg:rounded-[14px]"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-[-0.02em] lg:text-[20px]">{view.car.title || "Pārbaudāmais auto"}</p>
              {meta ? <p className="mt-[3px] text-[12px] text-[#a1a1aa] lg:mt-1.5 lg:text-[14px]">{meta}</p> : null}
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 lg:mt-3 lg:text-[11px]">{hasVin ? "VIN" : "Numurzīme"}</p>
              <p className="mt-0.5 break-all font-mono text-[13.5px] font-semibold tracking-[0.04em] lg:mt-1.5 lg:text-[18px] lg:tracking-[0.08em]">
                {view.vin}
              </p>
              {hasVin ? null : (
                <p className="mt-1 text-[11px] text-[#a1a1aa] lg:text-[12px]">VIN noteiksim pēc numurzīmes CSDD reģistrā.</p>
              )}
            </div>
          </div>

          <Services className="hidden lg:block" />
        </div>
      </section>

      {/* Labā puse: apmaksa (telefonā tumša, uzreiz zem auto) */}
      <section className="px-4 lg:flex lg:items-center lg:bg-white lg:px-14 lg:py-10 lg:text-[#1d1d1f]">
        <form onSubmit={(e) => void onSubmit(e)} className="w-full lg:max-w-[420px]">
          <div className="mt-[18px] border-t border-white/10 pt-4 lg:mt-0 lg:border-0 lg:pt-0">
            <p className="text-[13px] font-semibold text-[#a1a1aa] lg:text-[15px] lg:text-[#6e6e73]">PROVIN Business datu atskaite</p>
            <p className="mt-1 text-[30px] font-extrabold tracking-[-0.03em] lg:text-[40px]">{amount}</p>
            <p className="mt-1 text-[13px] leading-normal text-[#a1a1aa] lg:mt-2 lg:text-[14px] lg:text-[#6e6e73]">
              Visi pieejamie vēstures dati par šo auto vienā atskaitē.
            </p>
            <div className="mt-2.5 flex gap-2.5 rounded-xl border border-white/[0.08] bg-white/5 px-3 py-2.5 text-[12px] leading-normal text-[#a1a1aa] lg:mt-4 lg:border-0 lg:bg-[#f5f5f7] lg:px-3.5 lg:py-3 lg:text-[#6e6e73]">
              <Info className="mt-px h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span>
                Šī ir vēstures datu atskaite. Tehnisko risku izvērtējumu un konsultāciju piedāvā{" "}
                <Link href="/lv" target="_blank" className="font-semibold text-white underline lg:text-[#1d1d1f]">
                  PROVIN audits
                </Link>
                .
              </span>
            </div>
          </div>

          <div className="my-3.5 h-px bg-white/10 lg:my-5 lg:bg-[#1d1d1f]/10" />

          <Field label="E-pasts">
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="epasts@piemers.lv"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Tālrunis" optional>
            <input
              className={inputClass}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+371"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <details className="mt-3 border-t border-white/10 pt-2.5 lg:mt-4 lg:border-[#1d1d1f]/10 lg:pt-3.5">
            <summary className="flex cursor-pointer list-none justify-between text-[13px] font-semibold after:opacity-50 after:content-['+'] [&::-webkit-details-marker]:hidden">
              Rēķins uzņēmumam
            </summary>
            <Field label="Uzņēmums">
              <input className={inputClass} autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <Field label="Reģ. nr.">
              <input className={inputClass} autoComplete="off" value={companyReg} onChange={(e) => setCompanyReg(e.target.value)} />
            </Field>
            <Field label="Juridiskā adrese">
              <input className={inputClass} autoComplete="street-address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            </Field>
          </details>

          <label className="mt-3 flex items-start gap-2.5 text-[12px] leading-normal text-[#a1a1aa] lg:mt-4 lg:text-[#6e6e73]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563eb]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Piekrītu{" "}
              <Link href="/lv/lietosanas-noteikumi" className="underline" target="_blank">
                Lietošanas noteikumiem
              </Link>{" "}
              un{" "}
              <Link href="/lv/privatuma-politika" className="underline" target="_blank">
                Privātuma politikai
              </Link>
              , pilnvaroju PROVIN iegūt auto datus manā vārdā, piekrītu tūlītējai izpildei un apzinos, ka zaudēju atteikuma
              tiesības, kad izpilde ir sākusies.
            </span>
          </label>

          {error ? <p className="mt-3 text-[13px] font-medium text-red-400 lg:text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            style={{ fontWeight: 700 }}
            className="mt-3.5 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-[#2563eb] text-[17px] font-bold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60 lg:mt-[18px] lg:h-14"
          >
            {loading ? "Sagatavo…" : `Maksāt ${amount}`}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] opacity-60">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Droša apmaksa ar Stripe
          </p>
          <LegalReveal line={view.legalLine} tone="light" align="center" className="mt-6 hidden lg:block" />
        </form>
      </section>

      {/* Telefonā pakalpojumi zem formas */}
      <section className="px-4 pb-6 pt-5 lg:hidden">
        <Services className="" />
        <LegalReveal line={view.legalLine} tone="dark" align="center" className="mt-6" />
      </section>
    </div>
  );
}
