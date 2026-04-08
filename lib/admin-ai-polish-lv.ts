import "server-only";

/** OpenAI Chat Completions — latviešu gramatikas / stila labošana (admin). */
export const LV_POLISH_SYSTEM_PROMPT =
  "Tu esi profesionāls latviešu valodas redaktors un auto eksperta asistents. Tavs uzdevums ir izlabot gramatikas, interpunkcijas un drukas kļūdas iesniegtajā tekstā. Saglabā profesionālu, objektīvu toni, kas raksturīgs auto tehniskajām atskaitēm. Nemaini tehnisko informāciju (VIN, cenas, datus). Ja tekstā ir žargons, aizstāj to ar literāru valodu. Atgriez TIKAI laboto tekstu bez komentāriem.";

const MAX_INPUT_CHARS = 48_000;

export async function polishLatvianTextWithOpenAi(raw: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("missing_openai_key");
  }
  const text = raw.slice(0, MAX_INPUT_CHARS);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: LV_POLISH_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`openai_http_${res.status}:${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = data.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) {
    throw new Error("openai_empty_response");
  }
  return out.trim();
}
