import { AppShell } from "@/components/app-shell";
import { SupabaseLogoutButton } from "@/components/supabase-logout-button";
import { parentNav } from "@/lib/navigation";
import { requireSupabaseRole } from "@/lib/server/account-session";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSupabaseRole("parent");
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "Parent";

  return (
    <AppShell
      role="parent"
      navItems={parentNav}
      topActions={
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-white">{firstName}</p>
            <p className="text-xs text-white/70">Parent account</p>
          </div>
          <SupabaseLogoutButton />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
