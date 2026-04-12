"use client";

type Props = {
  text: string;
  className?: string;
};

/**
 * „APPROVED BY IRISS” — burti pa vienam no kreisās + vienreizējs shine sweep.
 * `prefers-reduced-motion` — statisks teksts (globālie CSS).
 */
export function ApprovedByIrissReveal({ text, className = "" }: Props) {
  const chars = text.split("");
  const shineDelayMs = Math.min(chars.length * 38 + 200, 1200);

  return (
    <p
      className={`hero-approved-reveal ${className}`.trim()}
      aria-label={text}
      style={{ ["--hero-approved-shine-delay" as string]: `${shineDelayMs}ms` }}
    >
      <span className="hero-approved-reveal__shine" aria-hidden>
        <span className="hero-approved-reveal__shine-sweep" />
      </span>
      <span className="relative z-[1] inline-block">
        {chars.map((char, i) => (
          <span
            key={i}
            className="hero-approved-char"
            style={{ animationDelay: `${i * 38}ms` }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    </p>
  );
}
