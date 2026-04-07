"use client";

import { AdminVendorAvotuSourceBlock } from "@/components/admin/AdminVendorAvotuSourceBlock";
import type { CitiAvotiBlockState } from "@/lib/admin-source-blocks";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";

type Props = {
  value: CitiAvotiBlockState;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CitiAvotiBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  collapsible?: boolean;
  pdfInclude: boolean;
  onPdfIncludeChange: (next: boolean) => void;
};

/** Citi avoti — tā pati struktūra kā AutoDNA / CarVertical (nobraukums + negadījumi + komentāri). */
export function AdminCitiAvotiSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  collapsible,
  pdfInclude,
  onPdfIncludeChange,
}: Props) {
  return (
    <AdminVendorAvotuSourceBlock
      blockKey="citi_avoti"
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      onChange={onChange}
      trafficFillLevel={trafficFillLevel}
      collapsible={collapsible}
      pdfInclude={pdfInclude}
      onPdfIncludeChange={onPdfIncludeChange}
    />
  );
}
