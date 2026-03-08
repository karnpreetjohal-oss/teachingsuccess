"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const YEAR_GROUPS = Array.from({ length: 13 }, (_, index) => `Year ${index + 1}`);

function buildSuggestedAccessCode(label: string) {
  const slug = label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = Math.floor(Math.random() * 900 + 100);
  return `TS-${slug.slice(0, 12) || "STUDENT"}-${stamp}`;
}

type CreateStudentResult = {
  action: "created" | "updated";
  student: {
    id: string;
    fullName: string;
    yearGroup: string;
    email: string | null;
  };
  accessCode: {
    accessCode: string;
    expiresAt: string | null;
  };
  usesPinLoginOnly: boolean;
  issuedPin: string;
};

export function CreateStudentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [yearGroup, setYearGroup] = useState("Year 7");
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState(buildSuggestedAccessCode("Student"));
  const [pin, setPin] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [rotateExisting, setRotateExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CreateStudentResult | null>(null);

  const suggestedAccessCode = useMemo(
    () => buildSuggestedAccessCode(fullName || "Student"),
    [fullName]
  );

  useEffect(() => {
    if (!accessCode || accessCode.startsWith("TS-STUDENT-")) {
      setAccessCode(suggestedAccessCode);
    }
  }, [accessCode, suggestedAccessCode]);

  const createStudent = () => {
    setError(null);
    setStatus(null);
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/tutor/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName,
            yearGroup,
            email,
            accessCode,
            pin,
            expiresAt,
            rotateExisting
          })
        });

        const payload = (await response.json()) as {
          error?: string;
          action?: "created" | "updated";
          student?: CreateStudentResult["student"];
          accessCode?: CreateStudentResult["accessCode"];
          usesPinLoginOnly?: boolean;
        };

        if (!response.ok || !payload.student || !payload.accessCode || !payload.action) {
          setError(payload.error || "Could not create student.");
          return;
        }

        const nextResult: CreateStudentResult = {
          action: payload.action,
          student: payload.student,
          accessCode: payload.accessCode,
          usesPinLoginOnly: Boolean(payload.usesPinLoginOnly),
          issuedPin: pin
        };

        setResult(nextResult);
        setStatus(
          payload.action === "created"
            ? "Student created and first PIN issued."
            : "Student updated and new PIN issued."
        );
        setFullName("");
        setYearGroup("Year 7");
        setEmail("");
        setPin("");
        setExpiresAt("");
        setAccessCode(buildSuggestedAccessCode("Student"));
        router.refresh();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not create student.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="blue">Create student</Badge>
          <Badge variant="gold">Issue first PIN</Badge>
        </div>
        <CardTitle>Add a student to the tutor app</CardTitle>
        <CardDescription>Create the student record and their first app login code in one step.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-full-name">
              Full name
            </label>
            <Input
              id="student-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Student full name"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-year-group">
              Year group
            </label>
            <select
              id="student-year-group"
              value={yearGroup}
              onChange={(event) => setYearGroup(event.target.value)}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {YEAR_GROUPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-email">
              Email address (optional)
            </label>
            <Input
              id="student-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional email for the student record"
            />
            <p className="text-sm text-brand-muted">
              Leave this blank if the student will use PIN login only.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-access-code">
              First access code
            </label>
            <Input
              id="student-access-code"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-pin">
              First PIN
            </label>
            <Input
              id="student-pin"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="4 to 8 digits"
              inputMode="numeric"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-code-expiry">
              Access expiry date
            </label>
            <input
              id="student-code-expiry"
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
            Deactivate existing codes if this email already belongs to a student
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

        {result ? (
          <div className="grid gap-2 rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
            <p className="font-semibold">{result.student.fullName}</p>
            <p>
              Year group: {result.student.yearGroup}
              {result.student.email ? ` • Email: ${result.student.email}` : " • PIN login only"}
            </p>
            <p>
              Access code: <span className="font-semibold">{result.accessCode.accessCode}</span>
            </p>
            <p>
              PIN: <span className="font-semibold">{result.issuedPin}</span>
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isPending || !fullName.trim() || !yearGroup.trim() || !accessCode.trim() || !pin.trim()}
            onClick={createStudent}
            className={buttonVariants()}
          >
            {isPending ? "Saving..." : "Create student"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setAccessCode(buildSuggestedAccessCode(fullName || "Student"))}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Suggest code
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
