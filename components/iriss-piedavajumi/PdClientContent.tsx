import type { IrissPdPublicContent } from "@/lib/iriss-piedavajumi";

/**
 * j75: klienta skatā - Aprīkojuma izcēlumi, «Stāvoklis» (fakti + vizuālais/tehniskais teksts) un Kopsavilkums
 * (cenā iekļauts / nav iekļauts). Tikai `IrissPdPublicContent` (ieslēgtās sadaļas, ieķeksētās rindas).
 */
export function PdClientContent({ content }: { content: IrissPdPublicContent | null }) {
  if (!content) return null;
  const { highlights, included, excluded, facts, visual, technical, note } = content;
  const condition = facts.length > 0 || visual || technical || note;
  return (
    <>
      {highlights.length ? (
        <>
          <div className="pdc-sec">Aprīkojums</div>
          <div className="pdc-chips">
            {highlights.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </>
      ) : null}
      {condition ? (
        <>
          <div className="pdc-sec">Stāvoklis</div>
          {facts.length ? (
            <div className="pdc-chips">
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          ) : null}
          {visual ? (
            <p className="pdc-txt">
              <b>Vizuālais novērtējums. </b>
              {visual}
            </p>
          ) : null}
          {technical ? (
            <p className="pdc-txt">
              <b>Tehniskais novērtējums. </b>
              {technical}
            </p>
          ) : null}
          {note ? <p className="pdc-txt">{note}</p> : null}
        </>
      ) : null}
      {included.length || excluded.length ? (
        <>
          <div className="pdc-sec">Kopsavilkums</div>
          <div className="pdc-sum">
            {included.length ? (
              <div>
                <b className="ok">Cenā iekļauts</b>
                <ul>
                  {included.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {excluded.length ? (
              <div>
                <b className="no">Cenā nav iekļauts</b>
                <ul>
                  {excluded.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
