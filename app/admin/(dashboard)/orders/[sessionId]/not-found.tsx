import Link from "next/link";

export default function AdminOrderNotFound() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-xl font-semibold text-[var(--color-apple-text)]">Pasūtījums nav atrasts</h1>
      <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
        Iespējams, ID ir nepareizs vai maksājums nav pabeigts.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block text-sm font-medium text-[var(--color-provin-accent)] hover:underline"
      >
        Atpakaļ uz sarakstu
      </Link>
    </div>
  );
}
