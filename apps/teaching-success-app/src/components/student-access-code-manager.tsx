"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccessCodeRow = {
  id: string;
  access_code: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type StudentAccessCodeManagerProps = {
  studentId: string;
  studentLabel: string;
  accessCodes: AccessCodeRow[];
};

function buildSuggestedAccessCode(label: string) {
  const slug = label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = Math.floor(Math.random() * 900 + 100);
  return `TS-${slug.slice(0, 12) || "STUDENT"}-${stamp}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never used";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function StudentAccessCodeManager({
  studentId,
  studentLabel,
  accessCodes
}: StudentAccessCodeManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accessCode, setAccessCode] = useState(buildSuggestedAccessCode(studentLabel));
  const [pin, setPin] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [rotateExisting, setRotateExisting] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => accessCodes.filter((code) => code.is_active).length,
    [accessCodes]
  );

  const createCode = () => {
    setStatus(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/app/api/tutor/students/${studentId}/access-codes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessCode,
            pin,
            expiresAt,
            rotateExisting
          })
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not create access code.");
          return;
        }

        setStatus("Access code created.");
        setPin("");
        setAccessCode(buildSuggestedAccessCode(studentLabel));
        router.refresh();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not create access code.");
      }
    });
  };

  const toggleCode = (id: string, nextActive: boolean) => {
    setStatus(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/app/api/tutor/access-codes/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            isActive: nextActive
          })
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not update access code.");
          return;
        }

        setStatus(nextActive ? "Access code reactivated." : "Access code deactivated.");
        router.refresh();
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Could not update access code.");
      }
    });
  };

  return (
    <div className="grid gap-4 rounded-[26px] border border-brand-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-ink">Student app access</p>
          <p className="text-sm text-brand-muted">{activeCount} active code{activeCount === 1 ? "" : "s"}</p>
        </div>
        <Badge variant="gold">PIN login</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`access-code-${studentId}`}>
            Access code
          </label>
          <input
            id={`access-code-${studentId}`}
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
            className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`pin-${studentId}`}>
            PIN
          </label>
          <input
            id={`pin-${studentId}`}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="4 to 8 digits"
            className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`expires-${studentId}`}>
            Expiry date
          </label>
          <input
            id={`expires-${studentId}`}
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
          />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={rotateExisting}
            onChange={(event) => setRotateExisting(event.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-blue focus:ring-brand-gold"
          />
          Deactivate current active codes first
        </label>
      </div>

      {status ? (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-3 text-sm text-brand-ink">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending || !accessCode.trim() || !pin.trim()}
          onClick={createCode}
          className={buttonVariants()}
        >
          {isPending ? "Saving..." : "Create or rotate code"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setAccessCode(buildSuggestedAccessCode(studentLabel))}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Suggest new code
        </button>
      </div>

      <div className="grid gap-3">
        {accessCodes.length ? (
          accessCodes.map((code) => (
            <div key={code.id} className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-ink">{code.access_code}</p>
                  <p className="text-sm text-brand-muted">
                    Last used: {formatDateTime(code.last_used_at)}
                    {code.expires_at ? ` • Expires ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(code.expires_at))}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={code.is_active ? "green" : "neutral"}>
                    {code.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleCode(code.id, !code.is_active)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {code.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-muted">
            No app access code has been created for this student yet.
          </div>
        )}
      </div>
    </div>
  );
}
