/**
 * IRISS un PRO telefona sākuma katalogs: visas ikonas un logrīki, ko var likt režģī.
 * Saturs un tiesības nāk no esošajām sadaļām (IRISS: sekcijas; PRO: visiem adminiem).
 */
import type { MenuCatalogItem } from "@/lib/admin-menu-layout";
import { canSeeIrissMobileMenuItem, IRISS_MOBILE_MENU_ITEMS } from "@/lib/iriss-mobile-menu";
import type { IrissSection } from "@/lib/staff-roles";

/** v11d-fix: iepriekšējais krāsu komplekts (b01), ne ikonas-v2 pelēkais. */
export const MENU_TONE = {
  blue: "linear-gradient(180deg,#4a95f5,#2f7fe6)",
  violet: "linear-gradient(180deg,#8a6cf0,#6a4ddf)",
  vin: "linear-gradient(180deg,#48484c,#2c2c2e)",
  order: "linear-gradient(180deg,#5d616b,#45484f)",
  csdd: "#0b6232",
  white: "#ffffff",
} as const;

const IRISS_APP_META: Record<string, { icon: string; tone: string; title?: string }> = {
  pasutijumi: { icon: "ord", tone: MENU_TONE.order },
  sludinajumi: { icon: "lst", tone: MENU_TONE.blue },
  radars: { icon: "rad", tone: MENU_TONE.violet },
  logistika: { icon: "pin", tone: MENU_TONE.white },
  autoparks: { icon: "dz", tone: MENU_TONE.white },
  pavadzimes: { icon: "csdd", tone: MENU_TONE.csdd },
  vin: { icon: "scan", tone: MENU_TONE.vin },
  atskaite: { icon: "rep", tone: MENU_TONE.order },
  iestatijumi: { icon: "set", tone: MENU_TONE.vin },
};

export function irissMenuCatalog(sections: readonly IrissSection[], isAdmin: boolean): MenuCatalogItem[] {
  const allowed = (section: string) =>
    canSeeIrissMobileMenuItem(
      { id: "", href: "", label: "", icon: "pasutijumi", group: 1, section: section as IrissSection },
      sections,
      isAdmin,
    );

  const apps: MenuCatalogItem[] = IRISS_MOBILE_MENU_ITEMS.filter((it) => allowed(it.section)).map((it) => {
    const meta = IRISS_APP_META[it.id] ?? { icon: "list", tone: "#6b7180" };
    return {
      id: it.id,
      kind: "app",
      title: it.label,
      href: it.href,
      sizes: ["app"],
      defaultSize: "app",
      section: it.section,
      icon: meta.icon,
      tone: meta.tone,
      badge: it.badge,
    };
  });

  const widgets: MenuCatalogItem[] = [
    {
      id: "w-logistika",
      kind: "widget",
      title: "Kravas un karte",
      href: "/admin/iriss/logistika",
      sizes: ["S", "M", "L", "app"],
      defaultSize: "M",
      section: "logistika",
      icon: "pin",
      tone: MENU_TONE.white,
      hideHead: true,
    },
    {
      id: "w-pavadzimes",
      kind: "widget",
      title: "Pavadzīmju termiņi",
      href: "/admin/iriss/pavadzimes",
      sizes: ["S", "M", "L", "app"],
      defaultSize: "M",
      rowsBySize: { S: 2, M: 4, L: 6 },
      section: "pavadzimes",
      icon: "csdd",
      tone: MENU_TONE.csdd,
      hideHead: true,
    },
    {
      id: "w-sludinajumi",
      kind: "widget",
      title: "Jauni sludinājumi",
      href: "/admin/iriss/sludinajumi",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "sludinajumi",
      icon: "lst",
      tone: MENU_TONE.blue,
    },
    {
      id: "w-radars",
      kind: "widget",
      title: "Radara atradumi",
      href: "/admin/iriss/scan",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "radars",
      icon: "rad",
      tone: MENU_TONE.violet,
    },
    {
      id: "w-autoparks",
      kind: "widget",
      title: "Autoparka laukums",
      href: "/admin/iriss/autoparks",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "logistika",
      icon: "dz",
      tone: MENU_TONE.white,
    },
  ];

  const kravas: MenuCatalogItem = {
    id: "kravas",
    kind: "app",
    title: "Kravas",
    href: "/admin/iriss/logistika",
    sizes: ["app"],
    defaultSize: "app",
    section: "logistika",
    icon: "box",
    tone: MENU_TONE.blue,
  };

  return [...apps, ...(allowed("logistika") ? [kravas] : []), ...widgets.filter((w) => allowed(w.section ?? ""))];
}

export const IRISS_DEFAULT_LAYOUT_IDS = [
  "autoparks",
  "pavadzimes",
  "logistika",
  "kravas",
  "vin",
  "pasutijumi",
  "sludinajumi",
  "radars",
];

const PRO_APPS: Array<Omit<MenuCatalogItem, "kind" | "sizes" | "defaultSize">> = [
  { id: "pro-pasutijumi", title: "Pasūtījumi", href: "/admin/dashboard", icon: "car", tone: "#1a73e8", badge: "orders" },
  { id: "pro-vin", title: "VIN pārbaude", href: "/admin/vin-scan", icon: "scan", tone: "#2b2f3a" },
  { id: "pro-atrie", title: "Ātrie", href: "/admin/atras-vertesanas", icon: "bolt", tone: "#ff9f0a", badge: "fast" },
  { id: "pro-rits", title: "Rīta kopsavilkums", href: "/admin/kopsavilkums", icon: "sun", tone: "#e0a800" },
  { id: "pro-partneri", title: "Partneri", href: "/admin/partneri", icon: "partners", tone: "#8e3fd1", badge: "partners" },
  { id: "pro-dileri", title: "Demo dīleri", href: "/admin/b2b-demo", icon: "dealers", tone: "#4f4ddb" },
  { id: "pro-izmaksas", title: "Izmaksas", href: "/admin/izmaksas", icon: "wallet", tone: "#23a046" },
  { id: "pro-rekini", title: "Rēķini", href: "/admin/commission-invoice", icon: "euro", tone: "#1795ad" },
  { id: "pro-blogs", title: "Blogs", href: "/admin/blogs", icon: "pen", tone: "#e2551b" },
  { id: "pro-agregati", title: "Agregātu zināšanas", href: "/admin/agregatu-zinasanas", icon: "cog", tone: "#5d636e" },
  { id: "pro-statistika", title: "Statistika", href: "/admin/statistika", icon: "chart", tone: "#e0244f" },
  { id: "pro-teksti", title: "Teksti", href: "/admin/teksti", icon: "msg", tone: "#6c7280" },
];

export function proMenuCatalog(): MenuCatalogItem[] {
  const apps: MenuCatalogItem[] = PRO_APPS.map((a) => ({ ...a, kind: "app", sizes: ["app"], defaultSize: "app" }));
  const widgets: MenuCatalogItem[] = [
    { id: "w-pro-mini", kind: "widget", title: "MINI + auditi", href: "/admin/dashboard", sizes: ["S", "M", "L", "app"], defaultSize: "M", icon: "car", tone: "#1a73e8" },
    { id: "w-pro-dileri", kind: "widget", title: "Dīleru dati gaidīšanā", href: "/admin/dashboard", sizes: ["S", "M", "app"], defaultSize: "S", icon: "dealers", tone: "#4f4ddb" },
    { id: "w-pro-ienemumi", kind: "widget", title: "Šodienas ieņēmumi", href: "/admin/dashboard", sizes: ["S", "M", "app"], defaultSize: "S", icon: "euro", tone: "#1f8f3a" },
    { id: "w-pro-atrie", kind: "widget", title: "Ātrie vērtējumi", href: "/admin/atras-vertesanas", sizes: ["S", "M", "app"], defaultSize: "S", icon: "bolt", tone: "#ff9f0a" },
    { id: "w-pro-rits", kind: "widget", title: "Šodienas plāns", href: "/admin/kopsavilkums", sizes: ["S", "M", "app"], defaultSize: "S", icon: "sun", tone: "#e0a800" },
  ];
  return [...apps, ...widgets];
}

export const PRO_DEFAULT_LAYOUT_IDS = ["w-pro-mini", "w-pro-dileri", "w-pro-ienemumi", "pro-pasutijumi", "pro-atrie", "pro-vin", "pro-rits", "pro-partneri", "pro-dileri", "pro-izmaksas", "pro-rekini", "pro-blogs", "pro-agregati", "pro-statistika", "pro-teksti"];
