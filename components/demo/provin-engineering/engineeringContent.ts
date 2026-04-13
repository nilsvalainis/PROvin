export type EngineeringHeroContent = {
  line1: string;
  auditWord: string;
  subtitle: string;
  pillars: string[];
};

export type EngineeringConceptRenderProps = {
  c: EngineeringHeroContent;
};

export type EngineeringConceptMeta = {
  id: string;
  n: number;
  title: string;
  theme: "A" | "B" | "C" | "D" | "E";
  blurb: string;
};

export const ENGINEERING_CONCEPT_METAS: EngineeringConceptMeta[] = [
  { n: 1, id: "energy-core", theme: "A", title: "Energy Core Cluster", blurb: "Centrālais pulsējošais mērinstruments slāņo ar virsrakstu — 3D klasteris." },
  { n: 2, id: "technical-grid", theme: "A", title: "Technical Diagram Grid", blurb: "0.5px sudraba režģis + peles paralakse pret kodolu." },
  { n: 3, id: "kinetic-assembly", theme: "A", title: "Kinetic Assembly", blurb: "Pavediena zīmēšana, tad stagger uz pīlāriem (Framer Motion)." },
  { n: 4, id: "metallic-type", theme: "A", title: "Metallic Embossed Typography", blurb: "Sudraba–balta gradienta reljefs ar mikro drop-shadow." },
  { n: 5, id: "gauge-orbit", theme: "A", title: "Gauge Orbit", blurb: "Rotējoši sudraba loki, saistīti ar scroll progresu." },
  { n: 6, id: "glass-dashboard", theme: "B", title: "Floating Glass Dashboard", blurb: "Premium stikls, blur(12px), sudraba mala, zils dziļuma spīdums." },
  { n: 7, id: "liquid-glass", theme: "B", title: "Liquid Glass Synthesis", blurb: "Šķidras līnijas un zili impulsi gar ceļu." },
  { n: 8, id: "reflection-panel", theme: "B", title: "Interactive Reflection Panel", blurb: "Slāņu paralakse + metāla atspīdums uz virsraksta." },
  { n: 9, id: "etched-pillars", theme: "B", title: "Etched Glass Pillar Icons", blurb: "Tīrs line-art, sudraba kontūra, zila migla." },
  { n: 10, id: "deep-focus", theme: "B", title: "Deep Focus Viewport", blurb: "Divi asimetriski riņķi, pretēja rotācija pret scroll." },
  { n: 11, id: "sequential-unroll", theme: "C", title: "Sequential Unrolling Diagram", blurb: "Pavediens kā ceļvedis; saturs atklājas secīgi ar scroll." },
  { n: 12, id: "hazy-focus", theme: "C", title: "Hazy Focus Change", blurb: "Tikai aktīvā zona asa; pārējās — blur + zemāka opacity." },
  { n: 13, id: "line-blueprint", theme: "C", title: "Line-Art Blueprint", blurb: "0.5px sudraba kontūras, stūru + zīmes, rasējuma estētika." },
  { n: 14, id: "morphing-core", theme: "C", title: "Morphing Core", blurb: "Šķidras metāla / zilas topogrāfijas morph pret scroll." },
  { n: 15, id: "assembly-line", theme: "C", title: "Assembly Line Sequence", blurb: "Pīlāru secīga parādīšanās ar spring + moduļu etiķetes." },
  { n: 16, id: "silver-spec", theme: "D", title: "Technical Silver Specification", blurb: "Gaišs pulēts sudrabs, reljefa tipogrāfija, minimālas robežas." },
  { n: 17, id: "negative-blueprint", theme: "D", title: "Negative Blueprint", blurb: "Matēts balts, sudraba līnijas, stagger ielāde." },
  { n: 18, id: "liquid-titanium", theme: "D", title: "Liquid Titanium Topography", blurb: "Šķidra titāna virsma, tehniskais režģis." },
  { n: 19, id: "synthesis-rings", theme: "D", title: "Synthesis Rings Topography", blurb: "Fokusa gredzeni un šķidra metāla lauks." },
  { n: 20, id: "data-matrix", theme: "D", title: "Data Matrix Overlay", blurb: "Koordinātu režģis, krusti, kodi, diskrēts pārklājums." },
  { n: 21, id: "interactive-assembly-tp", theme: "E", title: "Interactive Assembly Sequence (topo)", blurb: "Montāžas secība + topogrāfisks metāla fons." },
  { n: 22, id: "hazy-focus-tp", theme: "E", title: "Hazy Focus (topo)", blurb: "Slāņu blur gradācijas uz stagger līnijas." },
  { n: 23, id: "negative-blueprint-tp", theme: "E", title: "Negative Blueprint (topo)", blurb: "Balts fons, režģis, + zīmes un kodi." },
  { n: 24, id: "technical-tp", theme: "E", title: "Technical Topography", blurb: "Koordinātas, etiķetes, skaitļi, rasējuma blīvums." },
  { n: 25, id: "negative-topo-diagram", theme: "E", title: "Negative Topographical Diagram", blurb: "Kontūras, numerācija, skenēšanas ritms." },
  { n: 26, id: "kinetic-synthesis-tp", theme: "E", title: "Kinetic Synthesis Rings", blurb: "Koncentriski gredzeni, mērķa fokusa sajūta." },
  { n: 27, id: "kinetic-data-matrix-tp", theme: "E", title: "Kinetic Data Matrix", blurb: "Krusti, kodi, skenējoša frekvenču līnija." },
  { n: 28, id: "negative-kinetic-type-tp", theme: "E", title: "Negative Kinetic Typography", blurb: "Kastēts rasējums, tipogrāfijas kontūras." },
  { n: 29, id: "negative-technical-type-tp", theme: "E", title: "Negative Technical Typography", blurb: "Balts lauks, režģis, skaitliski marķieri." },
  { n: 30, id: "kinetic-typography-tp", theme: "E", title: "Kinetic Typography Topography", blurb: "Rotējoši fokusa elementi un koda skenēšana." },
];
