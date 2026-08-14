"use client";

type Props = {
  sourceLabel: string;
  count: number;
  disabled?: boolean;
  onClear: () => void;
};

export function AdminClearOdometerButton({ sourceLabel, count, disabled, onClear }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60"
      title={`Dzēst visus ielasītos odometra rādījumus — ${sourceLabel}`}
      aria-label={`Dzēst odometra rādījumus: ${sourceLabel}`}
      onClick={() => {
        const ok = window.confirm(
          count > 0
            ? `Dzēst visus ielasītos odometra rādījumus šajā avotā (${sourceLabel}, ${count} rindas / iekopējumi)? Negadījumi un komentāri paliks. Šo nevar atsaukt.`
            : `Strukturētu odometra rindu nav. Vai tik un tā notīrīt odometra iekopējumu šajā avotā (${sourceLabel})?`,
        );
        if (!ok) return;
        onClear();
      }}
    >
      Dzēst odometru
    </button>
  );
}
