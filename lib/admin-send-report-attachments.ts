/** Pielikumu rinda dialogā «Sūtīt atskaiti»: nosaukums, avots/veids, izmērs. */

export type SendReportAttachmentInput = {
  id: string;
  name?: string | null;
  filename?: string | null;
  mime?: string | null;
  size?: number | null;
};

export type SendReportAttachmentDisplay = {
  name: string;
  kind: string | null;
  sizeLabel: string | null;
  title: string;
};

const KIND_FROM_NAME: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /carvertical|car[\s._-]*vertical/i, label: "CarVertical" },
  { re: /autodna|auto[\s._-]*dna/i, label: "AutoDNA" },
];

function firstNonempty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const t = (v ?? "").trim();
    if (t) return t;
  }
  return "";
}

export function sendReportAttachmentKind(a: SendReportAttachmentInput): string | null {
  const name = firstNonempty(a.name, a.filename);
  const mime = (a.mime ?? "").trim().toLowerCase();
  for (const { re, label } of KIND_FROM_NAME) {
    if (re.test(name) || re.test(mime)) return label;
  }
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(name)) return "foto";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    if (/provin|audits|atskaite|mini|business/i.test(name)) return "PDF atskaite";
    return "PDF";
  }
  return null;
}

export function sendReportAttachmentName(a: SendReportAttachmentInput): string {
  const named = firstNonempty(a.name, a.filename);
  if (named) return named;
  return sendReportAttachmentKind(a) ?? "Pielikums";
}

/** Tukšs, ja izmērs nav zināms; 0 baiti paliek «0,0 MB». */
export function sendReportAttachmentSizeLabel(size: number | null | undefined): string | null {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return null;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function sendReportAttachmentDisplay(a: SendReportAttachmentInput): SendReportAttachmentDisplay {
  const name = sendReportAttachmentName(a);
  const kind = sendReportAttachmentKind(a);
  const sizeLabel = sendReportAttachmentSizeLabel(a.size);
  const title = kind && kind !== name ? `${name} (${kind})` : name;
  return {
    name,
    kind: kind && kind !== name ? kind : null,
    sizeLabel,
    title,
  };
}
