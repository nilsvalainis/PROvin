"use client";

import { useEffect, useState } from "react";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";

type Candidate = { id: string; name: string };

/**
 * J29 B: "Izvēlēties galveno bildi" - STOCK bilžu režģis, pašreizējā ar zilu apmali un ķeksi (pēc Nila
 * apstiprinātā maketa `j29/mockup/`). Izmanto to pašu `.ap2-modal`/`.ap2-mbox` logu, kas jau ir failu
 * skatītājam (pilnekrāna mobilajā, 760px centrēts dialogs datorā).
 */
export function AutoparksV2PhotoPicker({
  carId,
  onClose,
  onPicked,
}: {
  carId: string;
  onClose: () => void;
  onPicked: (basics: AutoparksV2Basics) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}/foto/kandidati`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; current?: string; candidates?: Candidate[] }) => {
        if (!alive) return;
        if (data.ok) {
          setCandidates(data.candidates ?? []);
          setCurrent(data.current ?? "");
        } else {
          setCandidates([]);
          setError("Neizdevās ielādēt bildes");
        }
      })
      .catch(() => {
        if (alive) {
          setCandidates([]);
          setError("Neizdevās ielādēt bildes");
        }
      });
    return () => {
      alive = false;
    };
  }, [carId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(dropboxId: string) {
    if (dropboxId === current || saving) return;
    setSaving(dropboxId);
    setError("");
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}/foto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dropboxId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; basics?: AutoparksV2Basics } | null;
    setSaving("");
    if (res?.ok && data?.ok && data.basics) {
      setCurrent(dropboxId);
      onPicked(data.basics);
      onClose();
    } else {
      setError("Neizdevās saglabāt galveno bildi");
    }
  }

  return (
    <div className="ap2-modal" role="dialog" aria-label="Izvēlēties galveno bildi" onClick={onClose}>
      <div className="ap2-mbox" onClick={(e) => e.stopPropagation()}>
        <div className="ap2-mh">
          <span className="t">Izvēlēties galveno bildi</span>
          <button type="button" className="ap2-x" onClick={onClose} aria-label="Aizvērt">
            ×
          </button>
        </div>
        <div className="ap2-picwrap">
          {error ? <p className="ap2-err">{error}</p> : null}
          {candidates === null ? (
            <p className="ap2-empty">Ielādē...</p>
          ) : candidates.length === 0 ? (
            <p className="ap2-empty">Nav STOCK bilžu</p>
          ) : (
            <div className="ap2-picgrid">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ap2-pic ${c.id === current ? "sel" : ""}`}
                  disabled={saving === c.id}
                  onClick={() => void pick(c.id)}
                  aria-label={c.name}
                  aria-pressed={c.id === current}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}/foto/kandidati/${encodeURIComponent(c.id)}`} alt="" loading="lazy" />
                  {c.id === current ? (
                    <span className="ap2-picchk" aria-hidden>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
