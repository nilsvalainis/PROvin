"use client";

import { useEffect, useState } from "react";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";

export function useAdminIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(ADMIN_MOBILE_MQ);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}
