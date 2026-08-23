/**
 * Stila korpuss ✨ promptam: valoda un termini no gatavām atskaitēm.
 * Aģents tos ADAPTĒ aktīvajam auditam — nekopē faktus un neaizstāj operatora piezīmes.
 */
import { PROVIN_STYLE_CORPUS_SAMPLES, type StyleCorpusField } from "@/lib/admin-ai-style-corpus-data";

const FIELD_LABEL: Record<StyleCorpusField, string> = {
  source: "avotu komentārs",
  technical_risks: "tehnisko risku ritms",
  inspection: "klātienes ieteikumu ritms",
  mileage: "nobraukuma ritms",
  incidents: "negadījumu ritms",
  summary: "kopsavilkuma ritms",
};

const MAX_SAMPLES = 10;
const MAX_SAMPLE_CHARS = 280;
const MAX_TOTAL_CHARS = 2_400;

export const AI_STYLE_CORPUS_RULES = `STYLE CORPUS (institutional language — not facts, not outline):
- Excerpts below are from OTHER finished PROVIN audits. They teach Latvian workshop wording, paragraph rhythm, and calm buyer tone.
- ADAPT: rewrite for THIS order's data, this ACTIVE FIELD, and this mileage/age band. Never paste a sample.
- SUPPLEMENT: if the sample is thinner than THIS audit (extra sources, operator notes, a different aggregate), add the missing buyer-relevant point in the same voice.
- CONNECT: bind every borrowed turn of phrase to a fact from THIS prompt (CSDD, AutoDNA, CarVertical, dealer, TA nosegums, OPERATORA KOMANDAS). If the sample mentions a part that this car does not have, drop it.
- OPERATOR NOTES WIN: if „OPERATORA KOMANDAS” ask for a theme or forbid one, that beats any sample.
- Few-shots in the system prompt teach STRUCTURE. This corpus teaches LANGUAGE. Do not mix the jobs.
- NEVER copy VIN, km, dates, EUR, seller names, wrap/plēve, or conclusions from a sample into the output. Samples teach wording, not this car’s story.`;

function clipSample(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_SAMPLE_CHARS) return t;
  return `${t.slice(0, MAX_SAMPLE_CHARS - 1).trim()}…`;
}

/** Kompakts stila bloks visiem ✨ laukiem. */
export function buildStyleCorpusAiContext(activeField?: StyleCorpusField | null): string {
  const preferred = activeField
    ? PROVIN_STYLE_CORPUS_SAMPLES.filter((s) => s.field === activeField)
    : [];
  const rest = PROVIN_STYLE_CORPUS_SAMPLES.filter((s) => s.field !== activeField);
  const ordered = [...preferred, ...rest].slice(0, MAX_SAMPLES);

  const parts: string[] = [
    "### PROVIN stilistiskā atmiņa (valoda un termini — NE fakti, NE struktūra)",
    AI_STYLE_CORPUS_RULES,
  ];
  let used = parts.join("\n").length;
  for (const sample of ordered) {
    const block = `Paraugs — ${FIELD_LABEL[sample.field]}:\n${clipSample(sample.text)}`;
    if (used + block.length + 2 > MAX_TOTAL_CHARS) break;
    parts.push(block);
    used += block.length + 2;
  }
  return parts.join("\n\n");
}

const FACT_LEAK_RE =
  /\b[A-HJ-NPR-Z0-9]{17}\b|\b\d{5,7}\s*km\b|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b\d[\d\s]{0,6}(?:[.,]\d{2})?\s*€|\bcs_[a-zA-Z0-9]+/i;

export function styleCorpusHasFactLeak(): boolean {
  return PROVIN_STYLE_CORPUS_SAMPLES.some((s) => FACT_LEAK_RE.test(s.text));
}
