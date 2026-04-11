import { getMessages } from "next-intl/server";
import { HowItWorksClient } from "@/components/HowItWorksClient";

type Step = { n: string; title: string; body: string };

export async function HowItWorks({
  tone = "light",
  variant = "default",
}: {
  tone?: "light" | "dark";
  variant?: "default" | "silver";
}) {
  const messages = await getMessages();
  const raw = (messages as { HowItWorks?: { steps?: Step[] } }).HowItWorks?.steps;
  const steps = Array.isArray(raw) ? raw : [];

  return <HowItWorksClient steps={steps} tone={tone} variant={variant} />;
}
