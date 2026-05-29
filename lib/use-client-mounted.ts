"use client";

import { useEffect, useState } from "react";

/** True pēc pirmā klienta mount — izvairās no SSR/CSR markup nesakritības. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
