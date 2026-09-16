type Props = {
  count: number;
  label: string;
};

/** Rose skaitļa poga admin izvēlnē (FAST, Partneri). */
export function AdminNavCountBadge({ count, label }: Props) {
  if (count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white"
      aria-label={label}
    >
      {text}
    </span>
  );
}
