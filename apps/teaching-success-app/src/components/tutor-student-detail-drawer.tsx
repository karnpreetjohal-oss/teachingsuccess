"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";

import { ParentLinkManager } from "@/components/parent-link-manager";
import { StudentAccessCodeManager } from "@/components/student-access-code-manager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ParentLinkRow = {
  id: string;
  created_at: string;
  parent: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

type AccessCodeRow = {
  id: string;
  access_code: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  subject: string;
  dueDate: string | null;
  status: string;
  latestSubmissionAt: string | null;
  createdAt: string;
};

type TutorStudentDetailDrawerProps = {
  studentId: string;
  studentLabel: string;
  yearGroup: string | null;
  subjects: string[];
  reviewCount: number;
  parentLinks: ParentLinkRow[];
  accessCodes: AccessCodeRow[];
  assignments: AssignmentRow[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function parentLabel(parent: ParentLinkRow["parent"]) {
  if (!parent) {
    return "Linked parent";
  }

  return parent.full_name || parent.email || "Linked parent";
}

export function TutorStudentDetailDrawer({
  studentId,
  studentLabel,
  yearGroup,
  subjects,
  reviewCount,
  parentLinks,
  accessCodes,
  assignments
}: TutorStudentDetailDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCodes = useMemo(
    () => accessCodes.filter((code) => code.is_active).length,
    [accessCodes]
  );

  const latestUsedAt = useMemo(() => {
    const values = accessCodes
      .map((code) => code.last_used_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return values[0] || null;
  }, [accessCodes]);

  const latestAssignment = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const aTime = new Date(a.latestSubmissionAt || a.createdAt).getTime();
      const bTime = new Date(b.latestSubmissionAt || b.createdAt).getTime();
      return bTime - aTime;
    })[0] || null;
  }, [assignments]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-brand-ink">{studentLabel}</p>
              <Badge variant="gold">{yearGroup || "Year group not set"}</Badge>
            </div>
            <p className="mt-2 text-sm text-brand-muted">
              {subjects.length ? subjects.join(", ") : "No subjects recorded yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open student
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Parents</p>
            <p className="mt-1 text-lg font-semibold text-brand-ink">{parentLinks.length}</p>
          </div>
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Active PINs</p>
            <p className="mt-1 text-lg font-semibold text-brand-ink">{activeCodes}</p>
          </div>
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Reviews</p>
            <p className="mt-1 text-lg font-semibold text-brand-ink">{reviewCount}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.length ? (
            subjects.map((subject) => (
              <Badge key={subject} variant="blue">
                {subject}
              </Badge>
            ))
          ) : (
            <Badge variant="neutral">Awaiting subject setup</Badge>
          )}
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close student panel"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-brand-ink/45 backdrop-blur-sm"
          />

          <div className="absolute inset-y-0 right-0 flex w-full justify-end">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`student-drawer-title-${studentId}`}
              className="h-full w-full max-w-[920px] overflow-y-auto bg-[#eef3fb] px-4 py-5 shadow-2xl sm:px-6"
            >
              <div className="mx-auto grid max-w-5xl gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-[30px] bg-brand-blue px-5 py-5 text-white shadow-soft sm:px-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="gold">{yearGroup || "Year group not set"}</Badge>
                      <Badge variant="green">{activeCodes} active PIN{activeCodes === 1 ? "" : "s"}</Badge>
                    </div>
                    <h2 id={`student-drawer-title-${studentId}`} className="mt-3 font-display text-3xl font-bold">
                      {studentLabel}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-white/82">
                      {parentLinks.length
                        ? `Linked parent${parentLinks.length === 1 ? "" : "s"}: ${parentLinks.map((link) => parentLabel(link.parent)).join(", ")}`
                        : "No parent linked yet. Add one below so this student's work is visible in the parent dashboard."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/18"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Overview</CardTitle>
                      <CardDescription>Operational snapshot for tutoring, access, and parent communication.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm leading-7 text-brand-ink">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Latest student app use</p>
                          <p className="mt-1 font-semibold">{formatDateTime(latestUsedAt)}</p>
                        </div>
                        <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Latest assignment</p>
                          <p className="mt-1 font-semibold">
                            {latestAssignment ? latestAssignment.title : "No assignment yet"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">Subjects</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {subjects.length ? (
                            subjects.map((subject) => (
                              <Badge key={subject} variant="blue">
                                {subject}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="neutral">No subjects recorded</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link href="/tutor/assignments/new" className={buttonVariants({ size: "sm" })}>
                          New assignment
                        </Link>
                        <Link href="/tutor/submissions" className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Review queue
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent teaching activity</CardTitle>
                      <CardDescription>Latest assignment history for this student.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {assignments.length ? (
                        [...assignments]
                          .sort((a, b) => {
                            const aTime = new Date(a.latestSubmissionAt || a.createdAt).getTime();
                            const bTime = new Date(b.latestSubmissionAt || b.createdAt).getTime();
                            return bTime - aTime;
                          })
                          .slice(0, 4)
                          .map((assignment) => (
                            <div
                              key={assignment.id}
                              className="rounded-[24px] border border-brand-line bg-white px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-semibold text-brand-ink">{assignment.title}</p>
                                <Badge variant="amber">{assignment.status}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-brand-muted">
                                {assignment.subject}
                                {assignment.dueDate ? ` • due ${formatDate(assignment.dueDate)}` : ""}
                              </p>
                              <p className="mt-1 text-sm text-brand-muted">
                                Latest activity: {formatDateTime(assignment.latestSubmissionAt || assignment.createdAt)}
                              </p>
                            </div>
                          ))
                      ) : (
                        <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
                          No assignments have been created for this student yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <ParentLinkManager
                    studentId={studentId}
                    studentLabel={studentLabel}
                    parentLinks={parentLinks}
                  />
                  <StudentAccessCodeManager
                    studentId={studentId}
                    studentLabel={studentLabel}
                    accessCodes={accessCodes}
                  />
                </section>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Done
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
