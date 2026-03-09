"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, EyeOff, UploadCloud, X } from "lucide-react";

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
  dueDate: string | null;
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
  const [subject, setSubject] = useState(initialAssignment?.subject ?? "");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewItems, setPreviewItems] = useState<
    Array<{
      id: string;
      name: string;
      url: string;
    }>
  >([]);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Record<string, true>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAssignment = assignments.find((assignment) => assignment.id === assignmentId) ?? null;

  useEffect(() => {
    const nextPreviewItems = files.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file)
    }));

    setPreviewItems(nextPreviewItems);
    setFailedPreviewIds({});

    return () => {
      nextPreviewItems.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [files]);

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
    if (mode === "assignment" && nextAssignment?.subject) {
      setSubject(nextAssignment.subject);
    }
  }, [assignmentId, assignments, initialAssignmentId, mode]);

  const handleFiles = (nextFiles: FileList | null) => {
    setFiles(Array.from(nextFiles || []).slice(0, 6));
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const formatDueDate = (value: string | null) => {
    if (!value) {
      return "No due date";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short"
    }).format(new Date(value));
  };

  const getStatusLabel = (value: string) => {
    if (value === "assigned") return "To do";
    if (value === "submitted") return "Awaiting review";
    return value;
  };

  const getStatusVariant = (value: string): "blue" | "amber" | "neutral" => {
    if (value === "assigned") return "blue";
    if (value === "submitted") return "amber";
    return "neutral";
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
          if (subject.trim()) {
            formData.set("subject", subject);
          }
          if (topic.trim()) {
            formData.set("topic", topic);
          }
          if (title.trim()) {
            formData.set("title", title);
          }
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
          <CardTitle>Upload work</CardTitle>
          <CardDescription>
            Choose a live assignment when the work was set by your tutor, or use quick upload for extra workbook pages and unplanned homework.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("assignment");
                const selected = assignments.find((assignment) => assignment.id === assignmentId) ?? initialAssignment;
                if (selected?.subject) {
                  setSubject(selected.subject);
                }
              }}
              className={buttonVariants({
                variant: mode === "assignment" ? "default" : "outline",
                size: "sm"
              })}
            >
              Existing assignment {assignments.length ? `(${assignments.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("quick");
                setSubject("");
                setTopic("");
                setTitle("");
              }}
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">Choose assignment</p>
                  <p className="text-sm leading-6 text-brand-muted">
                    Submit into the exact task your tutor already set.
                  </p>
                </div>
                <Badge variant="blue">{assignments.length} live</Badge>
              </div>
              {assignments.length ? (
                <div className="grid gap-3">
                  {assignments.map((assignment) => {
                    const isSelected = assignment.id === assignmentId;
                    return (
                      <button
                        key={assignment.id}
                        type="button"
                        onClick={() => {
                          setAssignmentId(assignment.id);
                          if (assignment.subject) setSubject(assignment.subject);
                        }}
                        className={cn(
                          "grid gap-3 rounded-[24px] border bg-white px-4 py-4 text-left transition",
                          isSelected
                            ? "border-brand-gold ring-2 ring-brand-gold/30"
                            : "border-brand-line hover:border-brand-blue/40"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">{assignment.subject}</Badge>
                          <Badge variant={getStatusVariant(assignment.status)}>{getStatusLabel(assignment.status)}</Badge>
                          <Badge variant="neutral">Due {formatDueDate(assignment.dueDate)}</Badge>
                        </div>
                        <div>
                          <p className="font-semibold text-brand-ink">{assignment.title}</p>
                          <p className="mt-1 text-sm leading-6 text-brand-muted">
                            {assignment.status === "submitted"
                              ? "This task already has work uploaded. Add more photos here if you need to continue it."
                              : "Photos and notes will be attached to this assignment."}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!assignments.length ? (
                <p className="text-sm leading-6 text-brand-muted">
                  No live assignments are waiting. Switch to quick upload to submit fresh work.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 rounded-[24px] border border-brand-line bg-brand-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">Quick upload</p>
                  <p className="text-sm leading-6 text-brand-muted">
                    Best for extra workbook pages, revision sheets, or homework your tutor has not set in the app yet.
                  </p>
                </div>
                <Badge variant="gold">Creates new tracked task</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject (leave blank to auto-detect)"
                />
                <Input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Topic (optional)"
                />
              </div>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title (leave blank to auto-detect)"
              />
              <p className="text-sm leading-6 text-brand-muted">
                If you do not know the subject or title, just upload the photos. The app will create a new task,
                scan the work, and fill in the subject/title after OCR.
              </p>
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

          {previewItems.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previewItems.map((preview, index) => (
                <div key={preview.id} className="overflow-hidden rounded-[22px] border border-brand-line bg-white">
                  <div className="relative aspect-square w-full bg-brand-surface">
                    {failedPreviewIds[preview.id] ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-brand-muted">
                        <EyeOff className="h-7 w-7 text-brand-blue" />
                        <p>Preview unavailable on this device, but the file is still selected.</p>
                      </div>
                    ) : (
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setFailedPreviewIds((current) => ({
                            ...current,
                            [preview.id]: true
                          }))
                        }
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink/75 text-white transition hover:bg-brand-ink"
                      aria-label={`Remove ${preview.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="border-t border-brand-line px-3 py-2 text-xs text-brand-muted">
                    {preview.name}
                  </div>
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
          <CardDescription>
            {mode === "assignment"
              ? "Your upload is being attached to an assignment that already exists."
              : "Your upload will create a fresh tracked task for your tutor to review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
          <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
            <p className="font-semibold text-brand-ink">Files ready</p>
            <p className="mt-1">{files.length} photo(s) selected.</p>
          </div>
          {mode === "assignment" && selectedAssignment ? (
            <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
              <p className="font-semibold text-brand-ink">Selected assignment</p>
              <p className="mt-1 font-medium text-brand-ink">{selectedAssignment.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="neutral">{selectedAssignment.subject}</Badge>
                <Badge variant={getStatusVariant(selectedAssignment.status)}>{getStatusLabel(selectedAssignment.status)}</Badge>
                <Badge variant="neutral">Due {formatDueDate(selectedAssignment.dueDate)}</Badge>
              </div>
            </div>
          ) : null}
          {mode === "quick" ? (
            <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
              <p className="font-semibold text-brand-ink">New task preview</p>
              <p className="mt-1">
                {title.trim()
                  ? `Quick Upload: ${title.trim()}`
                  : subject.trim()
                    ? `Quick Upload: ${subject.trim()}`
                    : "Quick Upload: subject and title will be filled after OCR if you leave them blank."}
              </p>
            </div>
          ) : null}
          <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
            <p className="font-semibold text-brand-ink">What happens next</p>
            <p className="mt-1">
              {mode === "assignment"
                ? "Your photos are attached to the selected task, the assignment moves to submitted, and OCR marking starts."
                : "A fresh task is created for your tutor, photos are stored, OCR marking starts, and the subject/title can update automatically from the work."}
            </p>
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
            disabled={isPending || files.length === 0 || (mode === "assignment" ? !assignmentId : false)}
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
