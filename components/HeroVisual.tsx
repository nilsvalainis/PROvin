/**
 * Pilna Hero sekcijas fona „gaisma” — pilns platums/augstums, bez centrēta rāmja.
 * Beidzas pie sekcijas apakšas; tālāk — Pricing sadaļas savs fons.
 */
export function HeroVisual() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(ellipse 90% 65% at 18% 8%, rgba(0, 102, 214, 0.15), transparent 58%),
          radial-gradient(ellipse 85% 60% at 88% 12%, rgba(0, 102, 214, 0.1), transparent 55%),
          radial-gradient(ellipse 75% 50% at 50% 4%, rgba(255, 255, 255, 0.92), transparent 48%),
          linear-gradient(165deg, rgba(255, 255, 255, 0.5) 0%, transparent 38%),
          linear-gradient(to bottom, #ffffff 0%, #f7f8fa 45%, #f0f2f5 100%)
        `,
      }}
      aria-hidden
    />
  );
}
