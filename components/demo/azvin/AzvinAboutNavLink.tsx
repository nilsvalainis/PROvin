"use client";

import { useEffect, useState } from "react";
import { getAzvinAboutCopy } from "@/lib/azvin-about-copy";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";

type Props = {
  className?: string;
};

export function AzvinAboutNavLink({ className }: Props) {
  const [locale, setLocale] = useState<AzvinLocale>("az");

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale(setLocale);
  }, []);

  const label = getAzvinAboutCopy(locale).eyebrow;

  return (
    <a href="#about" className={className}>
      {label}
    </a>
  );
}
