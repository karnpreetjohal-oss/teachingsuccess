import { AppShell } from "@/components/app-shell";
import { StudentLogoutButton } from "@/components/student-logout-button";
import { studentNav } from "@/lib/navigation";
import { requireStudentSession } from "@/lib/server/student-data";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudentSession();
  const firstName = session.fullName.trim().split(/\s+/)[0] || "Student";

  return (
    <AppShell
      role="student"
      navItems={studentNav}
      topActions={
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-white">{firstName}</p>
            <p className="text-xs text-white/70">{session.yearGroup || "Student access"}</p>
          </div>
          <StudentLogoutButton />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
