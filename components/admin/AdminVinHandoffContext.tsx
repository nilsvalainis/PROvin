"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AdminVinHandoffValue = {
  vin: string;
  setVin: (next: string) => void;
};

const AdminVinHandoffContext = createContext<AdminVinHandoffValue | null>(null);

export function AdminVinHandoffProvider({ children }: { children: ReactNode }) {
  const [vin, setVinState] = useState("");
  const setVin = useCallback((next: string) => {
    setVinState(next.replace(/[\s-]/g, "").toUpperCase());
  }, []);
  const value = useMemo(() => ({ vin, setVin }), [vin, setVin]);
  return <AdminVinHandoffContext.Provider value={value}>{children}</AdminVinHandoffContext.Provider>;
}

export function useAdminVinHandoff(): AdminVinHandoffValue | null {
  return useContext(AdminVinHandoffContext);
}
