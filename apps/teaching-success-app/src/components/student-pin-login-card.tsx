"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "GO"];

export function StudentPinLoginCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accessCode, setAccessCode] = useState("");
  const [pin, setPin] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const maskedPin = useMemo(() => pin.padEnd(4, "•").slice(0, Math.max(4, pin.length)), [pin]);

  const handleKeyPress = (key: string) => {
    if (key === "CLR") {
      setPin((value) => value.slice(0, -1));
      return;
    }
    if (key === "GO") {
      if (!isPending) handleSubmit();
      return;
    }
    setPin((value) => (value.length >= 8 ? value : `${value}${key}`));
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/student/pin-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessCode,
            pin,
            firstName
          })
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not sign in.");
          return;
        }

        router.push("/student");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not sign in.");
      }
    });
  };

  return (
    <Card className="bg-brand-ink text-white">
      <CardHeader>
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/18 text-brand-gold">
          <Smartphone className="h-6 w-6" />
        </div>
        <CardTitle className="text-white">Student PIN login</CardTitle>
        <CardDescription className="text-white/70">
          Add the student code, tap the PIN, and optionally confirm the first name for younger learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <label className="text-sm font-semibold text-white/78" htmlFor="access-code">
            Student code
          </label>
          <Input
            id="access-code"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
            placeholder="e.g. TS-AISHA-01"
            className="border-white/14 bg-white text-brand-ink"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>

        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-white/78" htmlFor="student-pin-readout">
              PIN
            </label>
            <Badge variant="gold">{pin.length}/8</Badge>
          </div>
          <div
            id="student-pin-readout"
            className="flex h-16 items-center justify-center rounded-2xl border border-white/12 bg-white/8 font-display text-3xl font-black tracking-[0.18em]"
          >
            {maskedPin}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {keypadDigits.map((key) => (
              <button
                key={key}
                type="button"
                disabled={isPending}
                onClick={() => handleKeyPress(key)}
                className={cn(
                  "h-14 rounded-2xl border text-base font-bold transition",
                  key === "GO"
                    ? "border-brand-gold bg-brand-gold text-brand-ink"
                    : key === "CLR"
                      ? "border-white/16 bg-white/10 text-white"
                      : "border-white/16 bg-white/6 text-white hover:bg-white/12"
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/6 p-4">
          <label className="text-sm font-semibold text-white/78" htmlFor="student-first-name">
            Optional first-name check
          </label>
          <Input
            id="student-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Enter first name"
            className="border-white/14 bg-white text-brand-ink"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className={buttonVariants({ size: "lg", className: "w-full" })}
        >
          {isPending ? "Signing in..." : "Start today's work"}
        </button>
      </CardContent>
    </Card>
  );
}
