import type { IrissSaitesKind, IrissSaitesView } from "@/lib/iriss-car-share";

function Chevron() {
  return (
    <svg className="iriss-saite-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: IrissSaitesKind }) {
  if (kind === "logistika") {
    return (
      <span className="iriss-saite-ic logistika" aria-hidden>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
          <circle cx="7" cy="17.5" r="1.8" />
          <circle cx="17" cy="17.5" r="1.8" />
        </svg>
      </span>
    );
  }
  if (kind === "autoparks") {
    return (
      <span className="iriss-saite-ic autoparks" aria-hidden>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 16V12l2-5h10l2 5v4M5 16h14M5 16v2M19 16v2" />
          <circle cx="8" cy="13" r="0.8" />
          <circle cx="16" cy="13" r="0.8" />
        </svg>
      </span>
    );
  }
  return (
    <span className="iriss-saite-ic pasutijums" aria-hidden>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4M10 12h5M10 16h5" />
      </svg>
    </span>
  );
}

function StatusChip({ status, label }: { status: "created" | "sent"; label: string }) {
  if (status === "sent") {
    return (
      <span className="iriss-saite-chip sent">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1f7a37" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />
        </svg>
        {label}
      </span>
    );
  }
  return (
    <span className="iriss-saite-chip ok">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a60d6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      {label}
    </span>
  );
}

export function IrissSaitesSection({
  view,
  copied = false,
  busy = false,
  onCopy,
  onWhatsApp,
  onCreate,
}: {
  view: IrissSaitesView;
  copied?: boolean;
  busy?: boolean;
  onCopy?: () => void;
  onWhatsApp?: () => void;
  /** Publiskās saites vēl nav - poga to izveido (Nils 27.10: tikai ar pogu). */
  onCreate?: () => void;
}) {
  const { crossLinks, share } = view;
  if (crossLinks.length === 0 && !share && !onCreate) return null;
  return (
    <section className="iriss-saite" aria-label="Saites">
      <h3 className="iriss-saite-sec">Saites</h3>
      {crossLinks.length > 0 ? (
        <div className="iriss-saite-card">
          {crossLinks.map((row) => (
            <a key={`${row.kind}:${row.href}`} className="iriss-saite-row" href={row.href}>
              <KindIcon kind={row.kind} />
              <span className="iriss-saite-tx">
                <b>{row.title}</b>
                {row.subtitle ? <span>{row.subtitle}</span> : null}
              </span>
              <Chevron />
            </a>
          ))}
        </div>
      ) : null}
      {share ? (
        <div className="iriss-saite-card fr">
          <div className="iriss-saite-st">
            <b>Publiskā saite</b>
            <StatusChip status={share.status} label={share.statusLabel} />
          </div>
          <div className="iriss-saite-badge">
            <span className="iriss-saite-chip np">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M15 9.3a3.5 3.5 0 1 0 0 5.4M7.5 11h5M7.5 13h5M5.5 5.5l13 13" />
              </svg>
              {share.badge}
            </span>
          </div>
          <div className="iriss-saite-url">
            <span>{share.displayUrl}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
          </div>
          <p className="iriss-saite-note">{share.note}</p>
          <div className="iriss-saite-acts">
            <button type="button" className="iriss-saite-btn" disabled={busy} onClick={onCopy}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="8" y="8" width="12" height="12" rx="3" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
              {copied ? "Nokopēts" : "Kopēt"}
            </button>
            <button type="button" className="iriss-saite-btn" disabled={busy} onClick={onWhatsApp}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />
                <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.4-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" />
              </svg>
              WhatsApp
            </button>
          </div>
        </div>
      ) : onCreate ? (
        <div className="iriss-saite-card fr">
          <div className="iriss-saite-st">
            <b>Publiskā saite</b>
          </div>
          <p className="iriss-saite-note">Klients redzēs auto, foto un pamatdatus bez cenas. Saite rodas tikai pēc šīs pogas.</p>
          <div className="iriss-saite-acts">
            <button type="button" className="iriss-saite-btn" disabled={busy} onClick={onCreate}>
              Izveidot saiti klientam
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
