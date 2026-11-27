"use client";

import { useMemo, useState, type ReactNode } from "react";

import { AdminPhotoLightbox, type AdminLightboxPhoto } from "@/components/admin/AdminPhotoLightbox";
import {
  buildThecarapiPdfModel,
  thecarapiLeafValues,
  thecarapiPdfDate,
  type ThecarapiPdfDamage,
  type ThecarapiPdfGrid,
  type ThecarapiPdfKv,
  type ThecarapiPdfModel,
} from "@/lib/thecarapi-pdf-model";
import { thecarapiSalePriceFromFields } from "@/lib/thecarapi-sale-price";
import { thecarapiPhotoWaitLabel } from "@/lib/thecarapi-photo-wait";
import { thecarapiPhotoCaption, type ThecarapiAdminRecord, type ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

type Tone = "ok" | "warn" | "alert" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  ok: "text-green-700",
  warn: "text-amber-700",
  alert: "text-red-700",
  neutral: "text-[var(--color-apple-text)]",
};

/** Tā pati skala kā PDF: ≤160 rūpnīcas, 161-300 pārkrāsots, >300 špaktelis. */
export function thecarapiAdminPaintTone(value: string): Tone {
  const n = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n)) return "neutral";
  if (n <= 160) return "ok";
  return n <= 300 ? "warn" : "alert";
}

function statusTone(value: string): Tone {
  const v = value.trim().toLowerCase();
  if (!v || /nav izmērām|nav zinām|nav pieejam/.test(v)) return "neutral";
  if (/^(ok|labs|laba|labā|kā jauna|jā)$/.test(v)) return "ok";
  if (/bojāt|nomain|kritisk|slikt|nolietot|nav ok|defekt|trūkst/.test(v)) return "alert";
  return "warn";
}

const STATUS_COL = (col: string): boolean => /novērtējums|statuss|stāvoklis/i.test(col);

function photoDay(photo: ThecarapiStoredPhoto, record: ThecarapiAdminRecord): string {
  const raw = (photo.date || record.photoDate || record.date || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? thecarapiPdfDate(raw, false) : raw;
}

function photoSrc(vin: string, id: string): string {
  return `/api/admin/sources/thecarapi/photo?vin=${encodeURIComponent(vin)}&photoId=${encodeURIComponent(id)}`;
}

function leafText(value: unknown): string {
  if (value == null) return "null";
  if (Array.isArray(value)) return value.length ? value.map((v) => String(v)).join(", ") : "[]";
  if (typeof value === "object") return "{}";
  return String(value);
}

function Section({ title, children, empty }: { title: string; children?: ReactNode; empty?: boolean }) {
  return (
    <section className="mt-3 min-w-0">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">{title}</h4>
      {empty ? <p className="text-[12px] font-medium text-red-700">nav datu</p> : children}
    </section>
  );
}

function KvList({ rows, tone }: { rows: readonly ThecarapiPdfKv[]; tone?: (row: ThecarapiPdfKv) => Tone }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      {rows.map((row, i) => {
        const t = row.highlight ? "alert" : (tone?.(row) ?? "neutral");
        return (
          <div key={`${row.label}-${i}`} className="flex min-w-0 justify-between gap-3 border-b border-slate-100 py-1 text-[12px] leading-snug">
            <dt className="shrink-0 text-[var(--color-provin-muted)]">{row.label}</dt>
            <dd className={`min-w-0 break-words text-right font-medium ${TONE_CLASS[t]}`}>{row.value || "-"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Grid({ grid, toneCol }: { grid: ThecarapiPdfGrid; toneCol?: (col: string) => boolean }) {
  const keep = grid.columns.map((_, i) => i === 0 || grid.rows.some((r) => (r[i] ?? "").trim()));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-slate-200 text-[11px] text-[var(--color-provin-muted)]">
          <tr>{grid.columns.map((c, i) => (keep[i] ? <th key={`${c}-${i}`} className="py-1 pr-3 font-semibold">{c}</th> : null))}</tr>
        </thead>
        <tbody>
          {grid.rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-100 last:border-b-0">
              {r.map((c, i) => {
                if (!keep[i]) return null;
                const t = c.trim() && toneCol?.(grid.columns[i] ?? "") ? statusTone(c) : "neutral";
                return (
                  <td key={i} className={`py-1 pr-3 ${TONE_CLASS[t]}`}>
                    {c.trim() || "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DamageZones({ rows }: { rows: readonly ThecarapiPdfDamage[] }) {
  const zones: { zone: string; items: ThecarapiPdfDamage[] }[] = [];
  for (const d of rows) {
    const z = d.zone || "Cita zona";
    const last = zones[zones.length - 1];
    if (last && last.zone === z) last.items.push(d);
    else zones.push({ zone: z, items: [d] });
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {zones.map(({ zone, items }, zi) => (
        <div key={`${zone}-${zi}`} className="rounded-lg border border-slate-200 px-2 py-1.5">
          <p className="text-[12px] font-semibold text-[var(--color-apple-text)]">{zone}</p>
          <ul className="mt-0.5 space-y-0.5">
            {items.map((d, i) => (
              <li key={i} className="text-[12px] leading-snug">
                <b className="font-medium">{d.part || "-"}</b>{" "}
                <span className="text-[var(--color-provin-muted)]">
                  {[d.type, d.size, d.quantity ? `${d.quantity} gab.` : "", d.repair ? `Remonts: ${d.repair}` : "", d.notes].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function damageCount(model: ThecarapiPdfModel): number | null {
  if (model.damagesTotal != null) return model.damagesTotal;
  if (model.damages.length) {
    return model.damages.reduce((sum, d) => {
      const n = Number.parseInt(d.quantity, 10);
      return sum + (Number.isFinite(n) && n > 0 ? n : 1);
    }, 0);
  }
  return null;
}

function summaryChips(model: ThecarapiPdfModel): string[] {
  const out: string[] = [];
  const price = model.prices.find((r) => r.label === "Noslēguma cena") ?? model.prices.find((r) => r.label === "Pēdējā cena");
  if (price) out.push(price.value);
  const odo = model.mileage.find((r) => r.label === "Nobraukums");
  if (odo) out.push(odo.value.replace(/\s*\(.+\)$/, ""));
  const n = damageCount(model);
  if (n != null) out.push(`${n} bojājumi`);
  return out;
}

type Lightbox = { record: number; index: number } | null;

function RecordBlock({
  vin,
  record,
  recordIndex,
  open,
  onPhoto,
}: {
  vin: string;
  record: ThecarapiAdminRecord;
  recordIndex: number;
  open: boolean;
  onPhoto: (record: number, index: number) => void;
}) {
  const model = useMemo(() => buildThecarapiPdfModel(record), [record]);
  const technical = useMemo(() => {
    const excluded = new Set(model.coverage.filter((c) => c.status === "excluded").map((c) => c.path));
    return thecarapiLeafValues(record).filter((leaf) => excluded.has(leaf.path));
  }, [model, record]);
  const chips = summaryChips(model);
  const photos = record.photos ?? [];
  const missingPhotos = Math.max(0, (record.photoUrls?.length ?? 0) - photos.length);
  const waitLabel = photos.length === 0 ? thecarapiPhotoWaitLabel(record.photoWait) : "";
  const damages = damageCount(model);
  const priceConflict = useMemo(() => thecarapiSalePriceFromFields(record.fields).conflict, [record]);
  const serviceRows: ThecarapiPdfKv[] = [
    ...(model.service.summary ? [{ label: "Kopsavilkums", value: model.service.summary }] : []),
    ...model.service.rows,
  ];

  return (
    <details open={open} className="rounded-lg border border-slate-200 bg-white" data-testid="tc-admin-lot">
      <summary className="cursor-pointer px-3 py-2">
        <span className="text-[13px] font-semibold text-[var(--color-apple-text)]">{model.header}</span>
        {chips.length ? <span className="block text-[12px] text-[var(--color-provin-muted)]">{chips.join(" · ")}</span> : null}
        {waitLabel ? <span className="block text-[12px] font-medium text-red-700">{waitLabel}</span> : null}
      </summary>
      <div className="border-t border-slate-100 px-3 pb-3">
        <Section title={`Pamatdati (${model.basics.length})`} empty={model.basics.length === 0}>
          <KvList rows={model.basics} />
        </Section>
        <Section title="Cenas" empty={model.prices.length === 0}>
          <KvList rows={model.prices} />
          {priceConflict ? <p className="mt-1 text-[12px] font-medium text-red-700">Pretruna: {priceConflict}</p> : null}
        </Section>
        <Section title="Nobraukums" empty={model.mileage.length === 0}>
          <KvList rows={model.mileage} />
        </Section>
        <Section title="Datumi" empty={model.dates.length === 0}>
          <KvList rows={model.dates} />
        </Section>
        <Section title={damages != null ? `Bojājumi (${damages})` : "Bojājumi"} empty={model.damages.length === 0}>
          <DamageZones rows={model.damages} />
        </Section>
        <Section title="Lakas biezums" empty={model.paint.length === 0}>
          <KvList
            rows={model.paint.map((p) => ({ ...p, value: /^\d+([.,]\d+)?$/.test(p.value.trim()) ? `${p.value} µm` : p.value }))}
            tone={(row) => thecarapiAdminPaintTone(row.value)}
          />
        </Section>
        {model.brakes?.rows.length ? (
          <Section title="Bremzes">
            <Grid grid={model.brakes} toneCol={STATUS_COL} />
          </Section>
        ) : null}
        {model.wheels.map((set, i) =>
          set.grid.rows.length ? (
            <Section key={`${set.title}-${i}`} title={`Riepas un diski - ${set.title}`}>
              <Grid grid={set.grid} toneCol={STATUS_COL} />
            </Section>
          ) : null,
        )}
        {serviceRows.length || model.service.entries?.rows.length ? (
          <Section title="Servisa vēsture">
            {serviceRows.length ? <KvList rows={serviceRows} /> : null}
            {model.service.entries?.rows.length ? <Grid grid={model.service.entries} /> : null}
          </Section>
        ) : null}
        {model.documents.length ? (
          <Section title="Dokumenti">
            <p className="text-[12px] text-[var(--color-apple-text)]">{model.documents.join(", ")}</p>
          </Section>
        ) : null}
        {model.equipment.length ? (
          <Section title={`Aprīkojums (${model.equipment.reduce((n, g) => n + g.items.length, 0)})`}>
            <div className="space-y-1.5">
              {model.equipment.map((g, i) => (
                <div key={`${g.group}-${i}`}>
                  <p className="text-[12px] font-medium text-[var(--color-apple-text)]">{g.group}</p>
                  <p className="text-[12px] leading-snug text-[var(--color-provin-muted)]">{g.items.join(", ")}</p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
        <Section title={`Citi dati (${model.other.length})`} empty={model.other.length === 0}>
          <KvList rows={model.other} />
        </Section>

        <Section title={`Bildes (${photos.length})`} empty={photos.length === 0}>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {photos.map((photo, i) => {
              const cat = model.photoCategories[photo.sourceUrl] ?? "";
              const cap = [photoDay(photo, record), cat].filter(Boolean).join(" · ");
              return (
                <button key={photo.id} type="button" onClick={() => onPhoto(recordIndex, i)} className="min-w-0 text-left" data-photo-id={photo.id}>
                  <img
                    src={photoSrc(vin, photo.id)}
                    alt={cap || "Izsoles bilde"}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-md bg-slate-100 object-cover"
                  />
                  <span className="mt-0.5 block truncate text-[10px] leading-snug text-[var(--color-apple-text)]">{cap || "-"}</span>
                </button>
              );
            })}
          </div>
        </Section>
        {waitLabel ? (
          <p className="mt-1 text-[12px] font-medium text-red-700" data-testid="tc-photo-wait">{waitLabel}</p>
        ) : missingPhotos > 0 ? (
          <p className="mt-1 text-[12px] font-medium text-red-700">Nav saglabātas: {missingPhotos} bildes</p>
        ) : null}

        {technical.length ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] text-[var(--color-provin-muted)]">Tehniskie lauki ({technical.length})</summary>
            <dl className="mt-1 space-y-0.5">
              {technical.map((leaf) => (
                <div key={leaf.path} className="break-all text-[10px] leading-snug text-slate-600">
                  <dt className="inline font-medium">{leaf.path}: </dt>
                  <dd className="inline">{leafText(leaf.value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-[var(--color-provin-muted)]">Neapstrādātais JSON</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-600">
            {JSON.stringify(record.raw ?? { history: record.rawHistory, detail: record.rawDetail, images: record.rawImages }, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  );
}

/** Izsoļu ieraksti adminā: visi lauki pa sadaļām (PDF modelis) + visas bildes ar datumu. Bez API izsaukumiem. */
export function AdminThecarapiRecords({ vin, records }: { vin: string; records: readonly ThecarapiAdminRecord[] }) {
  const [lightbox, setLightbox] = useState<Lightbox>(null);
  const lightboxPhotos: AdminLightboxPhoto[] = useMemo(() => {
    if (!lightbox) return [];
    const record = records[lightbox.record];
    if (!record) return [];
    const categories = buildThecarapiPdfModel(record).photoCategories;
    return (record.photos ?? []).map((photo) => ({
      id: photo.id,
      src: photoSrc(vin, photo.id),
      caption:
        [record.venue, photoDay(photo, record), categories[photo.sourceUrl] ?? ""].filter(Boolean).join(" · ") ||
        thecarapiPhotoCaption(record.venue, record.date),
    }));
  }, [lightbox, records, vin]);

  if (!records.length) return null;
  return (
    <div className="mt-3 space-y-2" data-testid="tc-admin-records">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
        TheCarApi · {records.length === 1 ? "1 izsole" : `${records.length} izsoles`}
      </p>
      {records.map((record, i) => (
        <RecordBlock
          key={`${record.site}-${record.id}-${record.date}-${i}`}
          vin={vin}
          record={record}
          recordIndex={i}
          open={records.length === 1}
          onPhoto={(r, index) => setLightbox({ record: r, index })}
        />
      ))}
      <AdminPhotoLightbox
        photos={lightboxPhotos}
        index={lightbox?.index ?? null}
        onIndexChange={(index) => setLightbox((cur) => (cur ? { ...cur, index } : cur))}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
