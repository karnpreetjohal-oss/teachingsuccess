"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AdultLoginCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (signInError || !data.user) {
          setError(signInError?.message || "Could not sign in.");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profileError || !profile) {
          setError("Signed in, but no profile record was found.");
          return;
        }

        if (profile.role === "parent") {
          router.push("/parent");
          router.refresh();
          return;
        }

        if (profile.role === "tutor") {
          router.push("/tutor");
          router.refresh();
          return;
        }

        await supabase.auth.signOut();
        setError("Students should use the PIN login instead of email and password.");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not sign in.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/16 text-brand-blue">
          <Mail className="h-6 w-6" />
        </div>
        <CardTitle>Parent / tutor login</CardTitle>
        <CardDescription>Use the existing Supabase account flow for adult accounts, then route by role automatically.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-brand-ink" htmlFor="adult-email">
            Email address
          </label>
          <Input
            id="adult-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-3">
          <label className="text-sm font-semibold text-brand-ink" htmlFor="adult-password">
            Password
          </label>
          <Input
            id="adult-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="blue">parent accounts live</Badge>
          <Badge variant="amber">tutor dashboards next</Badge>
        </div>
        {error ? (
          <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-brand-ink">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
        >
          {isPending ? "Signing in..." : "Open adult dashboard"}
        </button>
      </CardContent>
    </Card>
  );
}
