import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { ccVinSaleRowHasData } from "@/lib/cc-vin-report";
import { normalizeCcVinPhotoGroups } from "@/lib/cc-vin-photo-types";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { CHECKCAR_GROUP_PREFIX, CHECKCAR_RAW_MARKER } from "@/lib/checkcar-full-report";

/** Vai blokā ir CheckCar.vin pārlūka imports (RAW sadaļa vai foto grupa). */
export function quickEvalHasCheckcarImport(block: CcVinBlockState | null | undefined): boolean {
  if (!block) return false;
  if (block.rawUnprocessedData.includes(CHECKCAR_RAW_MARKER)) return true;
  return (block.photoGroups ?? []).some((g) => g.title.startsWith(CHECKCAR_GROUP_PREFIX) && g.photos.length > 0);
}

/**
 * Ātrā vērtējuma lapa: CheckCar.vin pilnās atskaites imports (izsoles, nobraukums, foto grupas).
 * Foto no `/api/admin/checkcar-import` (ātrā vērtējuma krātuve), ūdenszīmes kā avotā.
 */
export function AdminQuickEvalCheckcarSection({ peekId, block }: { peekId: string; block: CcVinBlockState }) {
  if (!quickEvalHasCheckcarImport(block)) return null;
  const sales = (block.sales ?? []).filter(ccVinSaleRowHasData);
  const mileage = (block.mileage ?? []).filter(autoRecordsRowHasData);
  const groups = normalizeCcVinPhotoGroups(block.photoGroups, block.photos).filter((g) => g.photos.length > 0);
  const photoSrc = (photoId: string) =>
    `/api/admin/checkcar-import?kind=quick_eval&id=${encodeURIComponent(peekId)}&photoId=${encodeURIComponent(photoId)}`;
  return (
    <section className="mt-3 rounded-2xl bg-white px-4 py-3 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]" data-testid="quick-eval-checkcar">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-apple-text)]">
        Izsoļu portālu arhīvs · CheckCar.vin
      </h3>
      {sales.length > 0 ? (
        <table className="w-full text-[12px]">
          <tbody>
            {sales.map((s, i) => (
              <tr key={`s${i}`} className="border-t border-slate-100">
                <td className="py-1 pr-2 whitespace-nowrap">{s.date || "-"}</td>
                <td className="py-1 pr-2">{s.venue || "-"}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{s.odometer ? `${s.odometer} km` : "-"}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{s.price || "-"}</td>
                <td className="py-1">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[12px] text-red-600">Izsoļu rindas nav nolasītas - pilns teksts ir pasūtījuma RAW laukā pēc eksporta.</p>
      )}
      {mileage.length > 0 ? (
        <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">
          Nobraukums: {mileage.map((m) => `${m.date} ${m.odometer} km`).join(" · ")}
        </p>
      ) : null}
      {groups.map((g) => (
        <div key={g.id} className="mt-3">
          <p className="mb-1 text-[12px] font-semibold text-[var(--color-apple-text)]">
            {g.title || CHECKCAR_GROUP_PREFIX} ({g.photos.length})
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {g.photos.map((p) => (
              <a key={p.id} href={photoSrc(p.id)} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc(p.id)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
