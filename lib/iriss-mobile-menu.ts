import type { AdminMobileIconName } from "@/lib/admin-mobile-ds";
import type { IrissSection } from "@/lib/staff-roles";

export type IrissMobileMenuBadge = "irissMatches" | "irissLogistics" | "waybills";

export type IrissMobileMenuItem = {
  id: string;
  href: string;
  label: string;
  icon: AdminMobileIconName;
  group: 1 | 2 | 3;
  section: IrissSection | "iestatijumi";
  badge?: IrissMobileMenuBadge;
};

const LOGISTICS_SECTIONS: readonly IrissSection[] = ["logistika", "gramatvede", "serviss"];

export const IRISS_MOBILE_MENU_ITEMS: readonly IrissMobileMenuItem[] = [
  { id: "pasutijumi", href: "/admin/iriss/pasutijumi", label: "Pasūtījumi", icon: "pasutijumi", group: 1, section: "pasutijumi" },
  {
    id: "sludinajumi",
    href: "/admin/iriss/sludinajumi",
    label: "Sludinājumi",
    icon: "sludinajums",
    group: 1,
    section: "sludinajumi",
    badge: "irissMatches",
  },
  { id: "radars", href: "/admin/iriss/scan", label: "Radars", icon: "radars", group: 1, section: "radars" },
  {
    id: "logistika",
    href: "/admin/iriss/logistika",
    label: "Loģistika",
    icon: "logistika",
    group: 2,
    section: "logistika",
    badge: "irissLogistics",
  },
  { id: "autoparks", href: "/admin/iriss/autoparks", label: "Autoparks", icon: "avatar", group: 2, section: "logistika" },
  {
    id: "pavadzimes",
    href: "/admin/iriss/pavadzimes",
    label: "Pavadzīmes",
    icon: "pavadzimes",
    group: 2,
    section: "pavadzimes",
    badge: "waybills",
  },
  { id: "vin", href: "/admin/vin-scan", label: "VIN pārbaude", icon: "vinParbaude", group: 3, section: "vin" },
  { id: "atskaite", href: "/admin/iriss/atskaite", label: "Atskaite", icon: "atskaite", group: 3, section: "atskaite" },
  { id: "iestatijumi", href: "/admin/iriss/iestatijumi", label: "Pārvaldība", icon: "iestatijumi", group: 3, section: "iestatijumi" },
];

export function canSeeIrissMobileMenuItem(
  item: IrissMobileMenuItem,
  sections: readonly IrissSection[],
  isAdmin: boolean,
): boolean {
  if (item.section === "iestatijumi") return isAdmin;
  if (isAdmin) return true;
  if (item.section === "logistika") return sections.some((id) => LOGISTICS_SECTIONS.includes(id));
  return sections.includes(item.section);
}

export function irissMobileMenuItemsFor(
  sections: readonly IrissSection[],
  isAdmin: boolean,
): IrissMobileMenuItem[] {
  return IRISS_MOBILE_MENU_ITEMS.filter((item) => canSeeIrissMobileMenuItem(item, sections, isAdmin));
}

export function irissMobileMenuGroups(items: readonly IrissMobileMenuItem[]): IrissMobileMenuItem[][] {
  return ([1, 2, 3] as const)
    .map((group) => items.filter((item) => item.group === group))
    .filter((group) => group.length > 0);
}

export function cheapIrissMenuCount(
  item: IrissMobileMenuItem,
  badges: { irissMatches: number; irissLogistics: number; waybills: number },
): number {
  if (item.badge === "irissMatches") return Math.max(0, badges.irissMatches);
  if (item.badge === "irissLogistics") return Math.max(0, badges.irissLogistics);
  if (item.badge === "waybills") return Math.max(0, badges.waybills);
  return 0;
}

/** Datora platums (Tailwind `md`), no kura IRISS izvēlnes lapu nerāda. */
export const IRISS_DESKTOP_MEDIA = "(min-width: 768px)";

/** Datorā IRISS atver pirmo atļauto sadaļu (adminam Pasūtījumi). */
export function irissDesktopHomeHref(items: readonly IrissMobileMenuItem[]): string | null {
  return items[0]?.href ?? null;
}
