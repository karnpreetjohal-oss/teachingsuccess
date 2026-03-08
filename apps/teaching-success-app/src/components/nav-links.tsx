"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookCheck,
  BookOpen,
  Camera,
  ClipboardList,
  FileBarChart2,
  Home,
  ListChecks,
  PlusSquare,
  TriangleAlert,
  Users
} from "lucide-react";

import type { NavIcon, NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap: Record<NavIcon, typeof Home> = {
  home: Home,
  upload: Camera,
  practice: BookCheck,
  progress: BarChart3,
  homework: ClipboardList,
  mistakes: TriangleAlert,
  reports: FileBarChart2,
  curriculum: BookOpen,
  students: Users,
  assign: PlusSquare,
  review: ListChecks
};

type NavLinksProps = {
  items: NavItem[];
  mobile?: boolean;
};

export function NavLinks({ items, mobile = false }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        mobile
          ? "fixed inset-x-4 bottom-4 z-40 grid grid-cols-4 gap-2 rounded-[26px] border border-brand-line bg-white/92 p-2 shadow-soft backdrop-blur"
          : "flex flex-wrap gap-2"
      )}
      style={mobile ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
              mobile ? "flex-col px-2 py-2 text-[11px]" : "min-h-11",
              active
                ? "border-brand-gold bg-brand-gold/18 text-brand-ink shadow-[0_12px_24px_rgba(245,200,66,0.15)]"
                : "border-transparent bg-white/60 text-brand-muted hover:border-brand-line hover:bg-white"
            )}
          >
            <Icon className={cn("h-4 w-4", mobile && "h-4 w-4")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
