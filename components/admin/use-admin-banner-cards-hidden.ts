"use client";

import { useCallback, useEffect, useState } from "react";

/** UI izvēle visiem pasūtījumiem. Neietekmē PDF un saglabāto JSON. */
const STORAGE_KEY = "provin-admin-banner-cards-hidden";

export function useAdminBannerCardsHidden() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      // Noklusējums: paslēptas. Rādīt tikai ja operators to skaidri izvēlējies ("0").
      setHidden(localStorage.getItem(STORAGE_KEY) !== "0");
    } catch {
      setHidden(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  return { hidden, toggle };
}
