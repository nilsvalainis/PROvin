import type { ReactElement } from "react";

/** PRO un rezerves līnijas (24 px, vilkums 1.8). */
const PATHS: Record<string, string[]> = {
  car: ["M5 17H3v-4l2.2-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3L21 13v4h-2 M3 13h18"],
  list: ["M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01"],
  radar: ["M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M12 2a10 10 0 1 0 10 10 M12 6a6 6 0 1 0 6 6 M12 12l7-7"],
  warehouse: ["M3 21V8l9-5 9 5v13 M7 21v-7h10v7 M7 17.5h10"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4 M14 3v4h4 M14 3l4 4v3"],
  chart: ["M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 9h18 M8 18v-4 M12 18v-6 M16 18v-3"],
  sliders: ["M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6"],
  bolt: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4"],
  partners: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"],
  dealers: ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z M10 6h4 M10 10h4"],
  wallet: ["M20 7H5a2 2 0 0 1 0-4h13v4 M3 5v14a2 2 0 0 0 2 2h15V7"],
  euro: ["M4 10h12 M4 14h9 M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"],
  pen: ["M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  cog: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3"],
  msg: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  home: ["M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
};

export function menuIconBleed(name: string): boolean {
  return name === "csdd";
}

export function menuIconPadded(name: string): boolean {
  return name === "dz";
}

function StrokeIcon({
  size,
  className,
  children,
}: {
  size: number;
  className?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/** Google Maps #pin no ikonas-v2/defs.txt. */
function MapsPin({ size, className }: { size: number; className?: string }): ReactElement {
  const h = Math.round(size * (34 / 24));
  return (
    <svg viewBox="0 0 24 34" width={size} height={h} className={className} aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill="#ea4335" />
      <path d="M12 0C8 0 4.5 2 2.4 5L12 12z" fill="#4285f4" />
      <path d="M2.4 5C.9 7 0 9.4 0 12c0 3 1.4 6.4 3.3 9.5L12 12z" fill="#fbbc04" />
      <path d="M12 12l-8.7 9.5C6.6 27 12 34 12 34s1.9-2 4.2-5.2z" fill="#34a853" />
      <circle cx="12" cy="12" r="4.3" fill="#a50e0e" />
    </svg>
  );
}

/** Vecā tipa Scan (#vin): stūri + vidus līnija. */
function VinScan({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M7 12h10" />
    </svg>
  );
}

function OrdIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <StrokeIcon size={size} className={className}>
      <rect x="3" y="3" width="11" height="14" rx="2" />
      <path d="M6 7l1 1 2-2M6 12l1 1 2-2M16 15l1.5-3h3L22 15v3h-6z" />
      <circle cx="17.5" cy="19" r="1" />
      <circle cx="20.5" cy="19" r="1" />
    </StrokeIcon>
  );
}

function LstIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <StrokeIcon size={size} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 14l5-4 4 3 3-2 6 4M14 4v-1.5h5" />
      <circle cx="16" cy="8.5" r="1.5" />
    </StrokeIcon>
  );
}

function RadIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <path d="M12 12l6-6M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
  );
}

function BoxIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <StrokeIcon size={size} className={className}>
      <path d="M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5" />
    </StrokeIcon>
  );
}

function RepIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <StrokeIcon size={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </StrokeIcon>
  );
}

function SetIcon({ size, className }: { size: number; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <circle cx="6" cy="14" r="2" fill="currentColor" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
      <circle cx="18" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}

/** size: px (atribūts, ne Tailwind), lai izmērs ir drošs jebkurā lapā. */
export function MenuIcon({ name, className, size = 40 }: { name: string; className?: string; size?: number }): ReactElement {
  if (name === "pin") return <MapsPin size={size} className={className} />;
  if (name === "csdd") {
    return <img src="/admin/menu/csdd.png" alt="" className={className} width={size} height={size} draggable={false} />;
  }
  if (name === "dz") {
    return <img src="/admin/menu/dz-trim.png" alt="" className={className} width={size} height={size} draggable={false} />;
  }
  if (name === "scan" || name === "vin") return <VinScan size={size} className={className} />;
  if (name === "ord") return <OrdIcon size={size} className={className} />;
  if (name === "lst") return <LstIcon size={size} className={className} />;
  if (name === "rad") return <RadIcon size={size} className={className} />;
  if (name === "box") return <BoxIcon size={size} className={className} />;
  if (name === "rep") return <RepIcon size={size} className={className} />;
  if (name === "set") return <SetIcon size={size} className={className} />;
  const paths = PATHS[name] ?? PATHS.list;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
