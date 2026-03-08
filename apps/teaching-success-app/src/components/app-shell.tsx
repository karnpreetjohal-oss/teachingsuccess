import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { NavLinks } from "@/components/nav-links";
import { Badge } from "@/components/ui/badge";
import type { NavItem } from "@/lib/navigation";

type AppShellProps = {
  role: "student" | "parent" | "tutor";
  navItems: NavItem[];
  topActions?: React.ReactNode;
  children: React.ReactNode;
};

const roleLabels = {
  student: "Student app",
  parent: "Parent app",
  tutor: "Tutor app"
};

export function AppShell({ role, navItems, topActions, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/55 bg-brand-ink/92 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gold font-display text-xl font-black text-brand-ink">
                TS
              </div>
              <div>
                <p className="font-display text-2xl font-black leading-none">Teaching Success</p>
                <p className="text-sm text-white/70">{roleLabels[role]}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {topActions}
              <Badge variant="gold" className="hidden md:inline-flex">
                Linked to existing Supabase backend
              </Badge>
              <Link
                href="https://www.teachingsuccess.co.uk"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/16 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Main site
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <NavLinks items={navItems} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-28 pt-6 md:px-6 md:pb-8 md:pt-8">
        {children}
      </main>
      <div className="md:hidden">
        <NavLinks items={navItems} mobile />
      </div>
    </div>
  );
}
