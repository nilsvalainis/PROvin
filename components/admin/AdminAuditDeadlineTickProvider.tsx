"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const TICK_MS = 60_000;

const AdminAuditDeadlineTickContext = createContext(0);

export function AdminAuditDeadlineTickProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AdminAuditDeadlineTickContext.Provider value={tick}>{children}</AdminAuditDeadlineTickContext.Provider>
  );
}

export function useAdminAuditDeadlineTick(): number {
  return useContext(AdminAuditDeadlineTickContext);
}
