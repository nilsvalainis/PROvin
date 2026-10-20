import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { PARTNER_CLIENT_MESSAGE_NAMESPACES, pickClientMessages } from "@/lib/i18n/client-messages";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** Partneru portāla klienta komponentēm vajag arī `Partner` vārdnīcu (pārējā vietnē to nesūta). */
export default async function PartnerMessagesLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = pickClientMessages(await getMessages(), PARTNER_CLIENT_MESSAGE_NAMESPACES);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
