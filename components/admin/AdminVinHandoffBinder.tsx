"use client";

import { useEffect } from "react";
import { useAdminVinHandoff } from "@/components/admin/AdminVinHandoffContext";

/** Reģistrē pašreizējā pasūtījuma VIN admin MENU joslai (un avotu virsrakstu saitēm). */
export function AdminVinHandoffBinder({ vin }: { vin: string }) {
  const setVin = useAdminVinHandoff()?.setVin;
  useEffect(() => {
    if (!setVin) return;
    setVin(vin);
    return () => setVin("");
  }, [setVin, vin]);
  return null;
}
