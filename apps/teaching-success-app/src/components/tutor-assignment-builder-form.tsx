"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getDefaultMarkingMode, markingModeLabel, MARKING_MODES } from "@/lib/tutor-helpers";

type BuilderStudent = {
  id: string;
  label: string;
  yearGroup: string | null;
};

type CurriculumUnit = {
  id: string;
  course: string | null;
  unit_title: string;
};

type CurriculumLesson = {
  id: string;
  unit_id: string;
  lesson_title: string;
  lesson_order: number | null;
};

type TutorAssignmentBuilderFormProps = {
  students: BuilderStudent[];
};

export function TutorAssignmentBuilderForm({ students }: TutorAssignmentBuilderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Maths");
  const [examBoard, setExamBoard] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [automarkEnabled, setAutomarkEnabled] = useState(true);
  const [automarkKeywords, setAutomarkKeywords] = useState("");
  const [automarkTargetWords, setAutomarkTargetWords] = useState("");
  const [markingMode, setMarkingMode] = useState(getDefaultMarkingMode("Maths", students[0]?.yearGroup));
  const [units, setUnits] = useState<CurriculumUnit[]>([]);
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedStudent = students.find((student) => student.id === studentId) ?? null;
  const lessonOptions = useMemo(
    () => lessons.filter((lesson) => lesson.unit_id === unitId),
    [lessons, unitId]
  );

  useEffect(() => {
    setMarkingMode(getDefaultMarkingMode(subject, selectedStudent?.yearGroup));
  }, [selectedStudent?.yearGroup, subject]);

  useEffect(() => {
    let cancelled = false;

    const loadCurriculum = async () => {
      if (!studentId || !subject.trim()) {
        setUnits([]);
        setLessons([]);
        setUnitId("");
        setLessonId("");
        return;
      }

      try {
        const params = new URLSearchParams({
          studentId,
          subject
        });
        if (examBoard.trim()) {
          params.set("examBoard", examBoard.trim());
        }

        const response = await fetch(`/app/api/tutor/curriculum?${params.toString()}`);
        const payload = (await response.json()) as {
          error?: string;
          units?: CurriculumUnit[];
          lessons?: CurriculumLesson[];
        };

        if (!response.ok) {
          throw new Error(payload.error || "Could not load curriculum.");
        }

        if (cancelled) return;

        const nextUnits = payload.units ?? [];
        const nextLessons = payload.lessons ?? [];
        setUnits(nextUnits);
        setLessons(nextLessons);
        setUnitId((current) => (nextUnits.some((unit) => unit.id === current) ? current : nextUnits[0]?.id ?? ""));
      } catch (curriculumError) {
        if (cancelled) return;
        setUnits([]);
        setLessons([]);
        setUnitId("");
        setLessonId("");
        setError(curriculumError instanceof Error ? curriculumError.message : "Could not load curriculum.");
      }
    };

    loadCurriculum();
    return () => {
      cancelled = true;
    };
  }, [examBoard, studentId, subject]);

  useEffect(() => {
    setLessonId((current) => (lessonOptions.some((lesson) => lesson.id === current) ? current : lessonOptions[0]?.id ?? ""));
  }, [lessonOptions]);

  const handleSubmit = () => {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("studentId", studentId);
        formData.set("title", title);
        formData.set("subject", subject);
        formData.set("examBoard", examBoard);
        formData.set("dueDate", dueDate);
        formData.set("description", description);
        formData.set("resourceTitle", resourceTitle);
        formData.set("resourceUrl", resourceUrl);
        formData.set("automarkEnabled", automarkEnabled ? "true" : "false");
        formData.set("automarkKeywords", automarkKeywords);
        formData.set("automarkTargetWords", automarkTargetWords);
        formData.set("markingMode", markingMode);
        formData.set("unitId", unitId);
        formData.set("lessonId", lessonId);
        if (attachmentFile) {
          formData.set("attachment", attachmentFile);
        }

        const response = await fetch("/app/api/tutor/assignments", {
          method: "POST",
          body: formData
        });

        const payload = (await response.json()) as {
          error?: string;
          warning?: string | null;
          assignment?: { id: string; title: string };
        };

        if (!response.ok || !payload.assignment) {
          setError(payload.error || "Could not create assignment.");
          return;
        }

        setStatus(`Assignment created: ${payload.assignment.title}`);
        setTitle("");
        setDescription("");
        setResourceTitle("");
        setResourceUrl("");
        setAttachmentFile(null);
        setAttachmentInputKey((current) => current + 1);
        setAutomarkKeywords("");
        setAutomarkTargetWords("");
        if (payload.warning) {
          setError(payload.warning);
          router.refresh();
          return;
        }

        router.push("/tutor");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Could not create assignment.");
      }
    });
  };

  if (!students.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No students available yet</CardTitle>
          <CardDescription>Students linked to your tutor account will appear here once they are available in the Teaching Success database.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="blue">Student</Badge>
          <Badge variant="gold">Curriculum-linked</Badge>
          <Badge variant="amber">Marking mode aware</Badge>
        </div>
        <CardTitle>Assignment setup</CardTitle>
        <CardDescription>Use this form to create real assignment rows in Supabase for the selected student.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-student-id">
              Student
            </label>
            <select
              id="asg-student-id"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.label}{student.yearGroup ? ` (${student.yearGroup})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-title">
              Assignment title
            </label>
            <Input id="asg-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Surds and index laws recall" />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-subject">
              Subject
            </label>
            <select
              id="asg-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {["Maths", "English", "Science", "11+", "General"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-exam-board">
              Exam board
            </label>
            <Input id="asg-exam-board" value={examBoard} onChange={(event) => setExamBoard(event.target.value)} placeholder="e.g. AQA, Edexcel, OCR" />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-due-date">
              Due date
            </label>
            <Input id="asg-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-marking-mode">
              Marking mode
            </label>
            <select
              id="asg-marking-mode"
              value={markingMode}
              onChange={(event) => setMarkingMode(event.target.value as (typeof MARKING_MODES)[number])}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {MARKING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {markingModeLabel(mode)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:col-span-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-description">
              Instructions
            </label>
            <textarea
              id="asg-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Instructions or success criteria"
              className="min-h-28 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-unit">
              Curriculum unit
            </label>
            <select
              id="asg-unit"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {units.length ? (
                units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_title}{unit.course ? ` • ${unit.course}` : ""}
                  </option>
                ))
              ) : (
                <option value="">No matching units found</option>
              )}
            </select>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-lesson">
              Lesson
            </label>
            <select
              id="asg-lesson"
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
              className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            >
              {lessonOptions.length ? (
                lessonOptions.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.lesson_order ? `L${lesson.lesson_order} • ` : ""}
                    {lesson.lesson_title}
                  </option>
                ))
              ) : (
                <option value="">No lessons loaded</option>
              )}
            </select>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-resource-title">
              Resource title
            </label>
            <Input id="asg-resource-title" value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="Optional label" />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-resource-url">
              Resource URL
            </label>
            <Input id="asg-resource-url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://..." />
          </div>

          <div className="grid gap-3 md:col-span-2">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-attachment">
              Worksheet attachment
            </label>
            <input
              key={attachmentInputKey}
              id="asg-attachment"
              type="file"
              accept=".pdf,image/*,.doc,.docx,.ppt,.pptx"
              onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-ink shadow-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-brand-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-ink focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
            />
            <p className="text-sm text-brand-muted">
              {attachmentFile ? `Selected file: ${attachmentFile.name}` : "Optional private worksheet or PDF for this assignment."}
            </p>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-keywords">
              Auto-mark keywords
            </label>
            <Input id="asg-keywords" value={automarkKeywords} onChange={(event) => setAutomarkKeywords(event.target.value)} placeholder="comma, separated, keywords" />
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-brand-ink" htmlFor="asg-target-words">
              Target words
            </label>
            <Input id="asg-target-words" value={automarkTargetWords} onChange={(event) => setAutomarkTargetWords(event.target.value)} placeholder="Optional number" inputMode="numeric" />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={automarkEnabled}
            onChange={(event) => setAutomarkEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-brand-line text-brand-blue focus:ring-brand-gold"
          />
          Enable OCR and auto-marking for this assignment
        </label>

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
            disabled={isPending || !studentId || !subject.trim() || !title.trim()}
            onClick={handleSubmit}
            className={buttonVariants({ size: "lg" })}
          >
            {isPending ? "Creating..." : "Create assignment"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setTitle("");
              setDescription("");
              setResourceTitle("");
              setResourceUrl("");
              setAttachmentFile(null);
              setAttachmentInputKey((current) => current + 1);
              setAutomarkKeywords("");
              setAutomarkTargetWords("");
              setStatus(null);
              setError(null);
            }}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Clear form
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
