"use client";

type Props = {
  text: string;
  className?: string;
};

/**
 * „APPROVED BY IRISS” — burti pa vienam no kreisās (2× lēnāks stagger nekā sākotnēji).
 * `prefers-reduced-motion` — statisks teksts (globālie CSS).
 */
export function ApprovedByIrissReveal({ text, className = "" }: Props) {
  const chars = text.split("");

  return (
    <p className={`hero-approved-reveal ${className}`.trim()} aria-label={text}>
      <span className="relative z-[1] inline-block">
        {chars.map((char, i) => (
          <span
            key={i}
            className="hero-approved-char"
            style={{ animationDelay: `${i * 76}ms` }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
    </p>
  );
}
