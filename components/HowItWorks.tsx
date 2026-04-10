import { getMessages } from "next-intl/server";
import { HowItWorksClient } from "@/components/HowItWorksClient";

type Step = { n: string; title: string; body: string };

export async function HowItWorks({ tone = "light" }: { tone?: "light" | "dark" }) {
  const messages = await getMessages();
  const steps = (messages as { HowItWorks: { steps: Step[] } }).HowItWorks.steps;

  return <HowItWorksClient steps={steps} tone={tone} />;
}
