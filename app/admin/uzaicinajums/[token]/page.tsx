import { StaffInviteAcceptForm } from "@/components/admin/StaffInviteAcceptForm";
import { peekStaffInvite } from "@/lib/staff-store";

export const metadata = {
  title: "Uzaicinājums | IRISS",
};

export const dynamic = "force-dynamic";

export default async function StaffInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const peek = await peekStaffInvite(token);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F4F6F9] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3d5bd9]">IRISS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Iestatīt pieeju</h1>
        {peek ? (
          <>
            <p className="mt-2 text-sm text-[#6b7280]">
              {peek.name} ({peek.email}), loma: {peek.role === "logistics" ? "Loģistika" : peek.role}.
            </p>
            <div className="mt-6">
              <StaffInviteAcceptForm token={token} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-[#6b7280]">Saite nav derīga, ir izmantota vai beigusies (24 h).</p>
        )}
      </div>
    </div>
  );
}
