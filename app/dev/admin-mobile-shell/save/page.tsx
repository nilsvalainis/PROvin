"use client";

import { AdminSaveButton } from "@/components/admin/AdminSaveButton";

/** Vizuālais tests vienotajai saglabāšanas pogai (PRO tēmā). Nav produkcijas izvēlnē. */
export default function SaveButtonTestPage() {
  return (
    <main className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center gap-2" data-testid="md">
        <AdminSaveButton onSave={() => undefined} state="idle" />
        <AdminSaveButton onSave={() => undefined} state="idle" dirty />
        <AdminSaveButton onSave={() => undefined} state="saving" />
        <AdminSaveButton onSave={() => undefined} state="saved" />
        <AdminSaveButton onSave={() => undefined} state="error" />
      </div>
      <div className="flex flex-wrap items-center gap-2" data-testid="sm">
        <AdminSaveButton size="sm" onSave={() => undefined} state="idle" dirty />
        <AdminSaveButton size="sm" onSave={() => undefined} state="saved" />
      </div>
    </main>
  );
}
