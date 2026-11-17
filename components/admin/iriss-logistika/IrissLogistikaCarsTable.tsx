"use client";

/**
 * Telefonā kabinetā (Nils 27.10, makets C1): «Rādīt kartē» un Autoparka kartīte, jo kravas rindā to vairs nav.
 * Datorā paslēpts - tur tie ir pašā rindā.
 */
export function CabinetPhoneMapAndCard({
  showOnMap,
  inPlan,
  onToggleMap,
  cardHref,
}: {
  showOnMap: boolean;
  inPlan: boolean;
  onToggleMap: (next: boolean) => void;
  cardHref?: string;
}) {
  if (!inPlan && !cardHref) return null;
  return (
    <div className="mb-3 flex w-full basis-full flex-col gap-1" data-cabinet-phone-extras="">
      {inPlan ? (
        <div className="flex min-h-11 items-center justify-between gap-3 md:hidden">
          <span className="text-[15px] text-[var(--iriss-ink)]">Rādīt kartē</span>
          <button
            type="button"
            role="switch"
            aria-checked={showOnMap}
            aria-label="Rādīt kartē"
            className={`iriss-log-switch ${showOnMap ? "on" : ""}`}
            onClick={() => onToggleMap(!showOnMap)}
          />
        </div>
      ) : null}
      {cardHref ? (
        <a href={cardHref} className="flex min-h-11 items-center justify-between text-[15px] text-[var(--iriss-ink)]">
          Autoparka kartīte
          <span aria-hidden className="text-[var(--iriss-ink-3)]">›</span>
        </a>
      ) : null}
    </div>
  );
}
