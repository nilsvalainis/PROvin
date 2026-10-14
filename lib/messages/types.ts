export type MessageChannel = "email" | "whatsapp" | "iriss" | "block";

export type MessageTemplateVar = {
  key: string;
  label: string;
  sample: string;
  required?: boolean;
};

export type MessageTemplateDef = {
  id: string;
  channel: MessageChannel;
  group: string;
  title: string;
  description?: string;
  /** E-pastam; WA/IRISS/blocks parasti bez temata. */
  subject?: string;
  body: string;
  vars: MessageTemplateVar[];
  tags?: string[];
  /** HTML ģenerēšanas stratēģija (noklusējums: vienkāršas rindkopas). */
  htmlKind?:
    | "plain_paragraphs"
    | "payment_confirmation"
    | "report_ready"
    | "partner_verify"
    | "partner_password_reset"
    | "listing_peek"
    | "dealer_operator";
  /** Papildu metadati HTML ģeneratoram (produkta veids u.c.). */
  meta?: Record<string, string>;
};

export type MessageTemplateOverride = {
  subject?: string;
  body: string;
  updatedAt: string;
  updatedBy: string;
};

export type MessageTemplatesDoc = {
  version: 1;
  overrides: Record<string, MessageTemplateOverride>;
};

export type RenderedMessage = {
  subject?: string;
  text: string;
  html?: string;
};
