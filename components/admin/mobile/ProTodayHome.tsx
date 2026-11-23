"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminMobileSearchField } from "@/components/admin/mobile/AdminMobileChrome";
import { AmxIcon } from "@/components/admin/mobile/AdminMobileGlass";
import { MenuIcon } from "@/components/admin/mobile/MenuIcons";
import type { ProTodayRow } from "@/lib/admin-pro-today";

export type ProTodaySection = { id: string; title: string; href: string; icon: string; badge?: number };

/** Galvenās sadaļas pirmajā ekrānā (22.11 makets v3, B). Pārējās - zem «Visas sadaļas». */
export const PRO_TODAY_PRIMARY_IDS = [
  "pro-pasutijumi",
  "pro-dilera",
  "pro-vin",
  "pro-atrie",
  "pro-arhivs",
  "pro-partneri",
  "pro-izmaksas",
  "pro-statistika",
  "pro-teksti",
] as const;

/** Īsāki nosaukumi 2 kolonnu sarakstā. */
const SHORT_TITLE: Record<string, string> = {
  "pro-arhivs": "Izsoļu arhīvs",
};

function SectionCell({ s }: { s: ProTodaySection }) {
  return (
    <Link href={s.href} className="amx-today-sec" data-pro-section={s.id}>
      <span className="amx-today-sec-ic" aria-hidden>
        <MenuIcon name={s.icon} size={18} />
      </span>
      <span className="amx-today-sec-t">{SHORT_TITLE[s.id] ?? s.title}</span>
      {s.badge && s.badge > 0 ? <span className="amx-today-sec-n">{s.badge > 99 ? "99+" : s.badge}</span> : null}
    </Link>
  );
}

/**
 * PRO sākums telefonā - «Šodien» (izvēlne B): augšā darāmais lielās rindās (skaitlis + kas jādara;
 * sarkans - kļūdas un kavējumi), pieskāriens atver filtrētu sarakstu; zem tā sadaļas 2 kolonnās ar vienas krāsas ikonām.
 */
export function ProTodayHome({
  rows,
  sections,
  onShowGrid,
}: {
  rows: ProTodayRow[];
  sections: ProTodaySection[];
  /** Esošais kārtojamais režģis ar logrīkiem (nekas netiek noņemts). */
  onShowGrid?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const primary = useMemo(
    () =>
      PRO_TODAY_PRIMARY_IDS.map((id) => sections.find((s) => s.id === id)).filter((s): s is ProTodaySection => Boolean(s)),
    [sections],
  );
  const rest = useMemo(() => sections.filter((s) => !(PRO_TODAY_PRIMARY_IDS as readonly string[]).includes(s.id)), [sections]);
  const query = q.trim().toLowerCase();
  const found = query ? sections.filter((s) => `${s.title} ${SHORT_TITLE[s.id] ?? ""}`.toLowerCase().includes(query)) : [];
  const searchOrders = () => {
    const v = q.trim();
    if (v.length >= 2) router.push(`/admin/dashboard?q=${encodeURIComponent(v)}`);
  };

  return (
    <div className="amx-today" data-pro-today>
      <div className="amx-today-search">
        <AdminMobileSearchField value={q} onChange={setQ} onSubmit={searchOrders} placeholder="Meklēt sadaļu, VIN, klientu" />
      </div>

      {query ? (
        <div className="amx-card amx-today-list" data-pro-today-search>
          {found.length > 0 ? (
            <div className="amx-today-grid">
              {found.map((s) => (
                <SectionCell key={s.id} s={s} />
              ))}
            </div>
          ) : null}
          {q.trim().length >= 2 ? (
            <button type="button" className="amx-row amx-today-find" onClick={searchOrders}>
              <span className="min-w-0 flex-1 truncate">Meklēt pasūtījumos: «{q.trim()}»</span>
              <AmxIcon name="chev" className="amx-today-chev" />
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {rows.length > 0 ? (
            <div className="amx-card amx-today-todo" data-pro-today-rows>
              {rows.map((r) => (
                <Link key={r.id} href={r.href} className="amx-row amx-today-row" data-pro-today-row={r.id} data-alert={r.alert || undefined}>
                  <span className={`amx-today-n${r.alert ? " amx-tx--red" : ""}`}>{r.count}</span>
                  <span className="min-w-0 flex-1">
                    <b className="amx-today-t">{r.title}</b>
                    <span className="amx-today-s">{r.sub}</span>
                  </span>
                  <AmxIcon name="chev" className="amx-today-chev" />
                </Link>
              ))}
            </div>
          ) : null}

          <div className="amx-lbl">Sadaļas</div>
          <div className="amx-card amx-today-list">
            <div className="amx-today-grid">
              {primary.map((s) => (
                <SectionCell key={s.id} s={s} />
              ))}
              {allOpen ? rest.map((s) => <SectionCell key={s.id} s={s} />) : null}
              <button
                type="button"
                className="amx-today-sec"
                aria-expanded={allOpen}
                onClick={() => setAllOpen((v) => !v)}
                data-pro-section="visas"
              >
                <span className="amx-today-sec-ic" aria-hidden>
                  <MenuIcon name="list" size={18} />
                </span>
                <span className="amx-today-sec-t">{allOpen ? "Mazāk" : "Visas sadaļas"}</span>
                {allOpen ? null : <span className="amx-today-sec-n">{sections.length}</span>}
              </button>
              {allOpen && onShowGrid ? (
                <button type="button" className="amx-today-sec" onClick={onShowGrid} data-pro-section="rezgis">
                  <span className="amx-today-sec-ic" aria-hidden>
                    <MenuIcon name="sliders" size={18} />
                  </span>
                  <span className="amx-today-sec-t">Logrīki</span>
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
