"use client";

import { adminMobileIconUrl, type AdminMobileIconName } from "@/lib/admin-mobile-ds";

export function AdminMobileIcon({
  name,
  className = "h-5 w-5",
  label,
}: {
  name: AdminMobileIconName;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`am-icon ${className}`}
      style={{
        WebkitMaskImage: `url(${adminMobileIconUrl(name)})`,
        maskImage: `url(${adminMobileIconUrl(name)})`,
      }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
