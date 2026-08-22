/**
 * Dzīvā teksta padeve no modeļa uz admin UI.
 *
 * Deltas ir TIKAI priekšskatījums — gala teksts vienmēr nāk pēc pēcapstrādes
 * (vārdu krājums, rindkopas, € filtrs), tāpēc laukā tiek ielikts tikai tas.
 */
export type AiTextStream = {
  onDelta: (chunk: string) => void;
  /** Sācies jauns mēģinājums (cits modelis, atkārtojums) — priekšskatījums jāsāk no tukša. */
  onRestart?: () => void;
};

/** SSE notikumi starp ✨ maršrutu un pārlūku. */
export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "restart" }
  | { type: "done"; text: string; usage?: unknown }
  | {
      type: "error";
      error: string;
      detail?: string;
      text?: string;
      incomplete?: boolean;
      usage?: unknown;
    };

export const AI_STREAM_CONTENT_TYPE = "text/event-stream";

export function encodeAiStreamEvent(event: AiStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
