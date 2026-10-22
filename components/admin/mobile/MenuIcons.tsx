import type { ReactElement } from "react";

/** Ikonas režģim: vienāds stils (24px, līnija 1.8). Loģistikai kartes tapa, kā Google Maps. */
const PATHS: Record<string, string[]> = {
  car: ["M5 17H3v-4l2.2-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3L21 13v4h-2 M3 13h18 M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"],
  list: ["M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01"],
  radar: ["M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M12 2a10 10 0 1 0 10 10 M12 6a6 6 0 1 0 6 6 M12 12l7-7"],
  warehouse: ["M3 21V8l9-5 9 5v13 M7 21v-7h10v7 M7 17.5h10"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4 M14 3v4h4 M14 3l4 4v3 M17 15v2l1.3 1"],
  scan: ["M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 12h10"],
  chart: ["M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 9h18 M8 18v-4 M12 18v-6 M16 18v-3"],
  sliders: ["M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6"],
  bolt: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4"],
  partners: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"],
  dealers: ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2 M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2 M10 6h4 M10 10h4 M10 14h4"],
  wallet: ["M20 7H5a2 2 0 0 1 0-4h13v4 M3 5v14a2 2 0 0 0 2 2h15V7 M16 14h.01"],
  euro: ["M4 10h12 M4 14h9 M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"],
  pen: ["M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  cog: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1"],
  msg: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  home: ["M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
};

/** Google Maps stila tapa: pilīte ar caurumu. Vilcienu vietā ikona ir skaidri kartes marķieris. */
const PIN_D = "M12 22s-7-6.1-7-11.5A7 7 0 0 1 19 10.5C19 15.9 12 22 12 22z";

/** size: px (atribūts, nevis Tailwind klase, lai izmērs ir drošs jebkurā lapā). */
export function MenuIcon({ name, className, size = 24 }: { name: string; className?: string; size?: number }): ReactElement {
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={PIN_D} fill="currentColor" fillOpacity={0.18} />
        <path d={PIN_D} />
        <circle cx="12" cy="10.5" r="2.6" />
      </svg>
    );
  }
  const paths = PATHS[name] ?? PATHS.list;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
