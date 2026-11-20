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
      {s.state !== "normal" ? (
        <>
          {/* «Drīzumā»/«Rezervēts» (Nils 20.11, variants A): uzraksts cenas vietā, cena mazāk zem līnijām (izslēgta = D). */}
          <div className={s.state === "reserved" ? "ap2-cl-price soon res" : "ap2-cl-price soon"}>
            <div className="v">{s.state === "reserved" ? "REZERVĒTS" : "DRĪZUMĀ"}</div>
            <div className="n">{s.state === "reserved" ? "auto ir rezervēts" : "auto tiek sagatavots pārdošanai"}</div>
          </div>
          {s.showPlannedPrice && s.priceEur != null ? (
            <div className="ap2-cl-plan">
              {s.state === "reserved" ? "Cena" : "Plānotā cena"} <b>{fmtEurRound(s.priceEur)}</b>
              {s.vatNote ? <span> {s.vatNote}</span> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="ap2-cl-price">
          <div className="v">{s.priceEur == null ? "" : fmtEurRound(s.priceEur)}</div>
          {s.vatNote ? <div className="n">{s.vatNote}</div> : null}
        </div>
      )}
      {s.rows.length > 0 ? (
        <>
          <div className="ap2-cl-lab">Tehniskie dati</div>
          {/* Daudz rindu (obligātie lauki + papildu, Nils 20.11) - blīvāk, lai A4 lapa nepārplūst. */}
          <div className={s.rows.length > 12 ? "ap2-cl-rows dense" : "ap2-cl-rows"}>
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
                <span>Informācija par esamību</span>
                <span>Informācija par pārbaudi</span>
              </span>
            </div>
            {s.safetyRows.map((r) => (
              <div key={r.label} className="ap2-cl-r">
                <span>{r.label}</span>
                <i />
                <span>
                  <span>{r.present}</span>
                  <span className={r.checked === "Gaida pārbaudi" ? "wait" : undefined}>{r.checked}</span>
                </span>
              </div>
            ))}
          </div>
          {s.roadworthy ? (
            <p className="ap2-cl-ok">Transportlīdzeklis tehniski atbilst izmantošanai ceļu satiksmē!</p>
          ) : s.pendingCheck ? (
            <p className="ap2-cl-note">Drošības sistēmu pārbaude tiks veikta pirms pārdošanas.</p>
          ) : null}
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
