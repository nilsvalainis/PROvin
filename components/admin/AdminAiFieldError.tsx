"use client";

/**
 * AI kļūda pie lauka. Agrāk to zīmēja 9px gaiši brūnā tekstā un operators to
 * nepamanīja — izskatījās, ka klikšķis nav nostrādājis, lai gan tokeni jau bija
 * apmaksāti. Tāpēc šeit apzināti pamanāms bloks.
 */
export function AdminAiFieldError({ message }: { message?: string | null }) {
  const text = message?.trim();
  if (!text) return null;
  return (
    <p
      role="alert"
      title={text}
      className="mb-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium leading-snug text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      {text}
    </p>
  );
}
