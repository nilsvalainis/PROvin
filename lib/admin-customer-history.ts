import {
  adminOrderHref,
  customerContactsMatch,
  isTelegramGroupPayment,
  paidProductLabel,
  type CustomerContactMatchVia,
} from "@/lib/admin-customer-identity";

export type CustomerHistoryPeekStatus = "new" | "in_progress" | "completed" | "rejected";

export type CustomerHistoryPeek = {
  id: string;
  createdAt: string;
  listingUrl: string;
  status: CustomerHistoryPeekStatus;
  /** Pilns teksts, kas nosūtīts klientam e-pastā (ja saglabāts). */
  comment: string | null;
  commentSentAt: string | null;
  matchVia: CustomerContactMatchVia;
};

export type CustomerHistoryPaid = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  productLabel: string;
  vin: string | null;
  isTelegramGroup: boolean;
  href: string;
  matchVia: CustomerContactMatchVia;
};

export type CustomerHistoryFlags = {
  telegramGroup: boolean;
  repeatPaid: boolean;
  hasPeek: boolean;
  hasSentPeekComment: boolean;
};

export type CustomerHistory = {
  peeks: CustomerHistoryPeek[];
  otherPaid: CustomerHistoryPaid[];
  flags: CustomerHistoryFlags;
};

export type CustomerHistoryPeekInput = {
  id: string;
  email: string;
  phone: string;
  listingUrl: string;
  createdAt: string;
  status: string;
  comment?: string;
  commentSentAt?: string;
};

export type CustomerHistoryPaidInput = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  checkoutLine?: string | null;
  vin: string | null;
  isDemo?: boolean;
  emails: Array<string | null | undefined>;
  phones: Array<string | null | undefined>;
};

const PEEK_STATUSES = new Set<CustomerHistoryPeekStatus>([
  "new",
  "in_progress",
  "completed",
  "rejected",
]);

export function emptyCustomerHistory(): CustomerHistory {
  return {
    peeks: [],
    otherPaid: [],
    flags: {
      telegramGroup: false,
      repeatPaid: false,
      hasPeek: false,
      hasSentPeekComment: false,
    },
  };
}

function peekStatus(raw: string): CustomerHistoryPeekStatus {
  return PEEK_STATUSES.has(raw as CustomerHistoryPeekStatus)
    ? (raw as CustomerHistoryPeekStatus)
    : "new";
}

export function buildCustomerHistory(input: {
  currentSessionId: string;
  currentEmails: Array<string | null | undefined>;
  currentPhones: Array<string | null | undefined>;
  currentAmountTotal?: number | null;
  peeks: CustomerHistoryPeekInput[];
  paid: CustomerHistoryPaidInput[];
}): CustomerHistory {
  const current = {
    emails: input.currentEmails,
    phones: input.currentPhones,
  };

  const peeks: CustomerHistoryPeek[] = [];
  for (const peek of input.peeks) {
    const via = customerContactsMatch(current, { emails: [peek.email], phones: [peek.phone] });
    if (!via) continue;
    const comment = typeof peek.comment === "string" && peek.comment.trim() ? peek.comment.trim() : null;
    const commentSentAt =
      typeof peek.commentSentAt === "string" && peek.commentSentAt.trim()
        ? peek.commentSentAt.trim()
        : null;
    peeks.push({
      id: peek.id,
      createdAt: peek.createdAt,
      listingUrl: peek.listingUrl,
      status: peekStatus(peek.status),
      comment,
      commentSentAt,
      matchVia: via,
    });
  }
  peeks.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const otherPaid: CustomerHistoryPaid[] = [];
  for (const row of input.paid) {
    if (row.id === input.currentSessionId) continue;
    if (row.isDemo) continue;
    const via = customerContactsMatch(current, { emails: row.emails, phones: row.phones });
    if (!via) continue;
    const telegram = isTelegramGroupPayment(row.amountTotal);
    otherPaid.push({
      id: row.id,
      created: row.created,
      amountTotal: row.amountTotal,
      currency: row.currency,
      productLabel: paidProductLabel({
        checkoutLine: row.checkoutLine,
        amountTotalCents: row.amountTotal,
      }),
      vin: row.vin?.trim() ? row.vin.trim() : null,
      isTelegramGroup: telegram,
      href: adminOrderHref({ id: row.id, checkoutLine: row.checkoutLine }),
      matchVia: via,
    });
  }
  otherPaid.sort((a, b) => b.created - a.created);

  const productPaid = otherPaid.filter((r) => !r.isTelegramGroup);
  return {
    peeks,
    otherPaid,
    flags: {
      telegramGroup:
        isTelegramGroupPayment(input.currentAmountTotal) || otherPaid.some((r) => r.isTelegramGroup),
      repeatPaid: productPaid.length > 0,
      hasPeek: peeks.length > 0,
      hasSentPeekComment: peeks.some((p) => Boolean(p.comment)),
    },
  };
}
