import { AppShell } from "@/components/app-shell";
import { SupabaseLogoutButton } from "@/components/supabase-logout-button";
import { tutorNav } from "@/lib/navigation";
import { requireSupabaseRole } from "@/lib/server/account-session";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSupabaseRole("tutor");
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "Tutor";

  return (
    <AppShell
      role="tutor"
      navItems={tutorNav}
      topActions={
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-white">{firstName}</p>
            <p className="text-xs text-white/70">Tutor account</p>
          </div>
          <SupabaseLogoutButton />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
