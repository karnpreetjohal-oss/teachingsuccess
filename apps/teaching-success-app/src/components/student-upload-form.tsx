"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AssignmentOption = {
  id: string;
  title: string;
  subject: string;
  status: string;
};

type StudentUploadFormProps = {
  assignments: AssignmentOption[];
  initialAssignmentId?: string;
};

export function StudentUploadForm({ assignments, initialAssignmentId }: StudentUploadFormProps) {
  const router = useRouter();
  const initialAssignment = assignments.find((assignment) => assignment.id === initialAssignmentId) ?? assignments[0] ?? null;
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"assignment" | "quick">(initialAssignment ? "assignment" : "quick");
  const [assignmentId, setAssignmentId] = useState(initialAssignment?.id ?? "");
  const [subject, setSubject] = useState(initialAssignment?.subject ?? "Maths");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  useEffect(() => {
    if (!assignments.length) {
      setMode("quick");
      setAssignmentId("");
      return;
    }

    const nextAssignment =
      assignments.find((assignment) => assignment.id === assignmentId) ??
      assignments.find((assignment) => assignment.id === initialAssignmentId) ??
      assignments[0];

    if (nextAssignment && nextAssignment.id !== assignmentId) {
      setAssignmentId(nextAssignment.id);
    }
    if (nextAssignment?.subject) {
      setSubject(nextAssignment.subject);
    }
  }, [assignmentId, assignments, initialAssignmentId]);

  const handleFiles = (nextFiles: FileList | null) => {
    setFiles(Array.from(nextFiles || []).slice(0, 6));
  };

  const handleSubmit = () => {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("mode", mode);
        formData.set("notes", notes);
        if (mode === "assignment") {
          formData.set("assignmentId", assignmentId);
        } else {
          formData.set("subject", subject);
          formData.set("topic", topic);
          formData.set("title", title);
          formData.set("markingMode", "generic_completion_review");
        }
        files.forEach((file) => formData.append("photos", file));

        setStatus("Uploading work...");
        const response = await fetch("/api/student/submissions", {
          method: "POST",
          body: formData
        });
        const payload = (await response.json()) as {
          error?: string;
          submissionId?: string;
          ocrTriggered?: boolean;
          ocrError?: string | null;
        };

        if (!response.ok || !payload.submissionId) {
          setError(payload.error || "Upload failed.");
          setStatus(null);
          return;
        }

        setStatus(payload.ocrTriggered ? "Upload complete. Opening results..." : `Upload complete. ${payload.ocrError || "OCR is still pending."}`);
        router.push(`/student/results/${payload.submissionId}`);
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Upload failed.");
        setStatus(null);
      }
    });
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/16 text-brand-blue">
            <Camera className="h-6 w-6" />
          </div>
          <CardTitle>Real upload flow</CardTitle>
          <CardDescription>Uploads go to `submission-files`, create `submission_files` rows, and trigger OCR marking.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("assignment")}
              className={buttonVariants({
                variant: mode === "assignment" ? "default" : "outline",
                size: "sm"
              })}
            >
              Existing assignment
            </button>
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={buttonVariants({
                variant: mode === "quick" ? "default" : "outline",
                size: "sm"
              })}
            >
              Quick upload
            </button>
          </div>

          {mode === "assignment" ? (
            <div className="grid gap-3 rounded-[24px] border border-brand-line bg-brand-surface p-4">
              <label className="text-sm font-semibold text-brand-ink" htmlFor="assignment-id">
                Choose assignment
              </label>
              <select
                id="assignment-id"
                value={assignmentId}
                onChange={(event) => {
                  const selected = assignments.find((assignment) => assignment.id === event.target.value);
                  setAssignmentId(event.target.value);
                  if (selected?.subject) setSubject(selected.subject);
                }}
                className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
              >
                {assignments.length ? (
                  assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.title} ({assignment.subject})
                    </option>
                  ))
                ) : (
                  <option value="">No assignments available</option>
                )}
              </select>
              {!assignments.length ? (
                <p className="text-sm leading-6 text-brand-muted">
                  No live assignments are waiting. Switch to quick upload to submit fresh work.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 rounded-[24px] border border-brand-line bg-brand-surface p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" />
              </div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional custom title" />
            </div>
          )}

          <div className="grid gap-3 rounded-[24px] border border-brand-line bg-brand-surface p-4">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="student-upload-notes">
              Note for the marker
            </label>
            <textarea
              id="student-upload-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add anything you found difficult..."
              className="min-h-28 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            />
          </div>

          <label
            htmlFor="student-upload-files"
            className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-brand-line bg-white/75 px-4 py-6 text-center"
          >
            <UploadCloud className="h-8 w-8 text-brand-blue" />
            <div>
              <p className="font-semibold text-brand-ink">Choose up to 6 photos</p>
              <p className="text-sm text-brand-muted">Camera captures and photo library uploads both work here.</p>
            </div>
          </label>
          <input
            id="student-upload-files"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />

          {previews.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map(({ file, url }) => (
                <div key={file.name + file.size} className="overflow-hidden rounded-[22px] border border-brand-line bg-white">
                  <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="gold" className="w-fit">
            Submission summary
          </Badge>
          <CardTitle>{mode === "assignment" ? "Existing assignment upload" : "Quick upload"}</CardTitle>
          <CardDescription>One clear action and one clear result path.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
          <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
            <p className="font-semibold text-brand-ink">Files ready</p>
            <p className="mt-1">{files.length} photo(s) selected.</p>
          </div>
          {mode === "assignment" && assignmentId ? (
            <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
              <p className="font-semibold text-brand-ink">Selected assignment</p>
              <p className="mt-1">
                {assignments.find((assignment) => assignment.id === assignmentId)?.title || "Assignment"}
              </p>
            </div>
          ) : null}
          <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
            <p className="font-semibold text-brand-ink">What happens next</p>
            <p className="mt-1">A submission row is created, photos are stored, assignment status moves to submitted, and OCR marking is triggered.</p>
          </div>
          {status ? (
            <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/10 px-4 py-3 text-brand-ink">
              {status}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-brand-ink">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            disabled={isPending || files.length === 0 || (mode === "assignment" ? !assignmentId : !topic.trim())}
            onClick={handleSubmit}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            {isPending ? "Submitting..." : "Submit for marking"}
          </button>
        </CardContent>
      </Card>
    </section>
  );
}
