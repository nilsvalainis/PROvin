import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { loadAppMessages } from "@/lib/i18n/load-app-messages";
import "@/app/[locale]/design-direction-theme.css";

export default async function TestCheckoutLayout({ children }: { children: ReactNode }) {
  const messages = await loadAppMessages("lv");

  return (
    <NextIntlClientProvider locale="lv" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
