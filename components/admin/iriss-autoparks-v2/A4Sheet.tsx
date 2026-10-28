/* eslint-disable @next/next/no-img-element */
import { priceSheetTitlePx, type V2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { DZINTARZEME_AUTO_LOGO_SVG_PUBLIC_PATH } from "@/lib/dzintarzeme-logo";
import { fmtEurRound } from "@/lib/iriss-autoparks-v2-format";

/** Cenu lapas A4 pēc maketa L7 (Nils 27.10): centrālā ass, plāns šrifts, viena cena. 794x1123 px = A4. */
export function A4Sheet({ s }: { s: V2PriceSheet }) {
  return (
    <div className="ap2-cl">
      <div className="ap2-cl-logo">
        <img src={DZINTARZEME_AUTO_LOGO_SVG_PUBLIC_PATH} alt="Dzintarzeme Auto" />
      </div>
      <h1 className="ap2-cl-title" style={{ fontSize: priceSheetTitlePx(s.displayName) }}>
        {s.displayName}
      </h1>
      {s.highlights.length > 0 ? (
        <div className="ap2-cl-hl">
          {s.highlights.map((h, i) => (
            <span key={h}>
              {i > 0 ? <span aria-hidden> · </span> : null}
              {h}
            </span>
          ))}
        </div>
      ) : null}
      <div className="ap2-cl-price">
        <div className="v">{s.priceEur == null ? "" : fmtEurRound(s.priceEur)}</div>
        {s.vatNote ? <div className="n">{s.vatNote}</div> : null}
      </div>
      {s.rows.length > 0 ? (
        <>
          <div className="ap2-cl-lab">Tehniskie dati</div>
          <div className="ap2-cl-rows">
            {s.rows.map((r) => (
              <div key={r.label} className="ap2-cl-r">
                <span>{r.label}</span>
                <i />
                <span>{r.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {s.safetyRows.length > 0 ? (
        <>
          <div className="ap2-cl-lab">Drošība</div>
          <div className="ap2-cl-rows sm">
            <div className="ap2-cl-r h">
              <span>Transportlīdzekļa drošības sistēmas</span>
              <i />
              <span>
                <span>Esamība</span>
                <span>Pārbaude</span>
              </span>
            </div>
            {s.safetyRows.map((r) => (
              <div key={r.label} className="ap2-cl-r">
                <span>{r.label}</span>
                <i />
                <span>
                  <span>{r.present}</span>
                  <span>{r.checked}</span>
                </span>
              </div>
            ))}
          </div>
          {s.roadworthy ? <p className="ap2-cl-ok">Transportlīdzeklis tehniski atbilst izmantošanai ceļu satiksmē!</p> : null}
        </>
      ) : null}
      <div className="ap2-cl-foot">
        <div className="l">
          +371 277 33 440
          <br />
          info@dzintarzemeauto.lv
        </div>
        <img src="/brands/inbank-qr.jpg" alt="Inbank QR kods" />
        <div>
          +371 204 205 39
          <br />
          www.dzintarzemeauto.lv
        </div>
      </div>
    </div>
  );
}
