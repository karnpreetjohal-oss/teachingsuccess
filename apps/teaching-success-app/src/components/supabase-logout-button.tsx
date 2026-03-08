"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SupabaseLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
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
