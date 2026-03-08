"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";

export function StudentLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/student/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        });
      }}
      className={buttonVariants({
        variant: "outline",
        size: "sm",
        className: "border-white/20 bg-white/8 text-white hover:bg-white/14"
      })}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
