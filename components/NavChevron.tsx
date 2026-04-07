/** Tās pašas stroke bultiņas kā Hero (#cena saitei); strokeWidth 1.75. */

const sw = 1.75;

export function NavChevronDown({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function NavChevronRight({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={sw} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6l6 6-6 6" />
    </svg>
  );
}
