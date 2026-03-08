"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ParentLinkRow = {
  id: string;
  parent: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

type ParentLinkManagerProps = {
  studentId: string;
  studentLabel: string;
  parentLinks: ParentLinkRow[];
};

type ParentLinkResult = {
  action: "created" | "linked" | "already_linked";
  parent: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
  issuedPassword: string | null;
};

function labelParent(parent: ParentLinkRow["parent"]) {
  if (!parent) {
    return "Linked parent";
  }
  return parent.full_name || parent.email || "Linked parent";
}

export function ParentLinkManager({
  studentId,
  studentLabel,
  parentLinks
}: ParentLinkManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParentLinkResult | null>(null);

  const linkParent = () => {
    setStatus(null);
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tutor/students/${studentId}/parents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            email,
            password
          })
        });

        const payload = (await response.json()) as {
          error?: string;
          action?: ParentLinkResult["action"];
          parent?: ParentLinkResult["parent"];
          issuedPassword?: string | null;
        };

        if (!response.ok || !payload.parent || !payload.action) {
          setError(payload.error || "Could not link parent.");
          return;
        }

        setResult({
          action: payload.action,
          parent: payload.parent,
          issuedPassword: payload.issuedPassword || null
        });

        if (payload.action === "created") {
          setStatus("Parent account created and linked.");
        } else if (payload.action === "linked") {
          setStatus("Existing parent linked to this student.");
        } else {
          setStatus("That parent was already linked to this student.");
        }

        setFullName("");
        setEmail("");
        setPassword("");
        router.refresh();
      } catch (linkError) {
        setError(linkError instanceof Error ? linkError.message : "Could not link parent.");
      }
    });
  };

  const unlinkParent = (linkId: string, parentLabel: string) => {
    setStatus(null);
    setError(null);
    setResult(null);

    if (!window.confirm(`Remove ${parentLabel} from ${studentLabel}?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tutor/parent-links/${linkId}`, {
          method: "DELETE"
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not remove parent link.");
          return;
        }

        setStatus("Parent link removed.");
        router.refresh();
      } catch (unlinkError) {
        setError(unlinkError instanceof Error ? unlinkError.message : "Could not remove parent link.");
      }
    });
  };

  return (
    <div className="grid gap-4 rounded-[26px] border border-brand-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-ink">Parent access</p>
          <p className="text-sm text-brand-muted">
            Link an existing parent by email, or create a new parent login for this student.
          </p>
        </div>
        <Badge variant="blue">Parent dashboard</Badge>
      </div>

      <div className="grid gap-3">
        {parentLinks.length ? (
          parentLinks.map((link) => {
            const parentLabel = labelParent(link.parent);

            return (
              <div
                key={link.id}
                className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-ink">{parentLabel}</p>
                    <p className="text-sm text-brand-muted">
                      {link.parent?.email || "Email not recorded"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="green">Linked</Badge>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => unlinkParent(link.id, parentLabel)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Unlink
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-muted">
            No parent account is linked to this student yet.
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`parent-name-${studentId}`}>
            Parent full name
          </label>
          <Input
            id={`parent-name-${studentId}`}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Required only when creating a new parent"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`parent-email-${studentId}`}>
            Parent email
          </label>
          <Input
            id={`parent-email-${studentId}`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="parent@example.com"
            autoComplete="email"
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-semibold text-brand-ink" htmlFor={`parent-password-${studentId}`}>
            Temporary password
          </label>
          <Input
            id={`parent-password-${studentId}`}
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank to generate one automatically"
          />
          <p className="text-sm text-brand-muted">
            Existing parents only need their email. If this is a new parent account, you can leave
            the password blank and the app will generate a temporary one.
          </p>
        </div>
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
      {result ? (
        <div className="grid gap-2 rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
          <p className="font-semibold">{result.parent.fullName || result.parent.email || "Parent account"}</p>
          <p>Email: {result.parent.email || "No email recorded"}</p>
          {result.issuedPassword ? (
            <p>
              Temporary password: <span className="font-semibold">{result.issuedPassword}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending || !email.trim()}
          onClick={linkParent}
          className={buttonVariants()}
        >
          {isPending ? "Saving..." : "Link parent"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setFullName("");
            setEmail("");
            setPassword("");
            setStatus(null);
            setError(null);
            setResult(null);
          }}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Clear form
        </button>
      </div>
    </div>
  );
}
