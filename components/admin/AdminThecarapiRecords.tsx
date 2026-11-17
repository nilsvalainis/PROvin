import { thecarapiPhotoCaption, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

export function AdminThecarapiRecords({
  vin,
  records,
}: {
  vin: string;
  records: readonly ThecarapiAdminRecord[];
}) {
  if (!records.length) return null;
  return (
    <div className="mt-3 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">TheCarApi lauki</p>
      {records.map((record) => {
        const caption = thecarapiPhotoCaption(record.venue, record.photoDate || record.date);
        return (
          <section key={`${record.site}-${record.id}-${record.date}`} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
            <h3 className="text-[12px] font-semibold text-[var(--color-apple-text)]">{caption}</h3>
            <dl className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
              {record.fields.map((field) => (
                <div key={field.key} className="min-w-0 text-[11px] leading-snug">
                  <dt className="inline font-medium text-[var(--color-provin-muted)]">{field.label}: </dt>
                  <dd className="inline break-words text-[var(--color-apple-text)]">{field.value || "-"}</dd>
                </div>
              ))}
            </dl>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-[var(--color-provin-muted)]">Neapstrādātais JSON</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-600">
                {JSON.stringify(record.raw, null, 2)}
              </pre>
            </details>
            {record.photos.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {record.photos.map((photo) => (
                  <figure key={photo.id} className="min-w-0">
                    <img
                      src={`/api/admin/sources/thecarapi/photo?vin=${encodeURIComponent(vin)}&photoId=${encodeURIComponent(photo.id)}`}
                      alt={photo.caption || caption}
                      className="h-24 w-full rounded-md object-cover"
                    />
                    <figcaption className="mt-1 text-[10px] leading-snug text-[var(--color-apple-text)]">
                      {photo.caption || caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
