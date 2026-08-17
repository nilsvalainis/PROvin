"use client";

import { AdminClipboardButton } from "@/components/admin/AdminClipboardButton";

export { AdminVinServiceLinkRow, AdminVinSourcesMenuBar } from "@/components/admin/AdminVinSourcesMenuBar";

/** Blakus VIN ievades laukam — kopē VIN uz starpliktuvi. */
export function AdminVinCopyButton({
  value,
  onCopied,
}: {
  value: string;
  onCopied?: () => void;
}) {
  return (
    <AdminClipboardButton
      value={value}
      onCopied={onCopied}
      titleReady="Kopēt VIN"
      titleCopied="Kopēts"
      ariaReady="Kopēt VIN starpliktuvē"
      ariaCopied="VIN nokopēts starpliktuvē"
    />
  );
}
