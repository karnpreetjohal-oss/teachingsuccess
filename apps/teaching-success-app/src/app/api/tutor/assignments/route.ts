import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultMarkingMode, MARKING_MODES, parseKeywordCsv, parseYearGroupInt } from "@/lib/tutor-helpers";

const ASSIGNMENT_FILES_BUCKET = "assignment-files";

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getSafeFileParts(fileName: string) {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const rawBaseName = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const rawExtension = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";

  return {
    baseName: sanitizeFileName(rawBaseName) || "attachment",
    extension: sanitizeFileName(rawExtension) || "file"
  };
}

function formValueToString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formValueToBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let studentId = "";
    let subject = "";
    let title = "";
    let description = "";
    let dueDate = "";
    let examBoard = "";
    let resourceTitle = "";
    let resourceUrl = "";
    let unitId = "";
    let lessonId = "";
    let automarkEnabled = false;
    let automarkKeywords: string[] = [];
    let automarkTargetWordsRaw = "";
    let markingModeRaw = "";
    let attachment: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      studentId = formValueToString(formData.get("studentId"));
      subject = formValueToString(formData.get("subject"));
      title = formValueToString(formData.get("title"));
      description = formValueToString(formData.get("description"));
      dueDate = formValueToString(formData.get("dueDate"));
      examBoard = formValueToString(formData.get("examBoard"));
      resourceTitle = formValueToString(formData.get("resourceTitle"));
      resourceUrl = formValueToString(formData.get("resourceUrl"));
      unitId = formValueToString(formData.get("unitId"));
      lessonId = formValueToString(formData.get("lessonId"));
      automarkEnabled = formValueToBoolean(formData.get("automarkEnabled"));
      automarkKeywords = parseKeywordCsv(formValueToString(formData.get("automarkKeywords")));
      automarkTargetWordsRaw = formValueToString(formData.get("automarkTargetWords"));
      markingModeRaw = formValueToString(formData.get("markingMode"));
      const rawAttachment = formData.get("attachment");
      attachment = rawAttachment instanceof File && rawAttachment.size > 0 ? rawAttachment : null;
    } else {
      const body = await request.json();
      studentId = String(body?.studentId || "").trim();
      subject = String(body?.subject || "").trim();
      title = String(body?.title || "").trim();
      description = String(body?.description || "").trim();
      dueDate = String(body?.dueDate || "").trim();
      examBoard = String(body?.examBoard || "").trim();
      resourceTitle = String(body?.resourceTitle || "").trim();
      resourceUrl = String(body?.resourceUrl || "").trim();
      unitId = String(body?.unitId || "").trim();
      lessonId = String(body?.lessonId || "").trim();
      automarkEnabled = Boolean(body?.automarkEnabled);
      automarkKeywords = parseKeywordCsv(String(body?.automarkKeywords || ""));
      automarkTargetWordsRaw = String(body?.automarkTargetWords || "").trim();
      markingModeRaw = String(body?.markingMode || "").trim();
    }

    if (!studentId || !subject || !title) {
      return NextResponse.json({ error: "Student, subject, and title are required." }, { status: 400 });
    }

    const { data: student, error: studentError } = await auth.supabase
      .from("profiles")
      .select("id,role,year_group")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student || student.role !== "student") {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    const automarkTargetWords =
      automarkTargetWordsRaw === "" ? null : Number(automarkTargetWordsRaw);

    if (
      automarkTargetWordsRaw !== "" &&
      (!Number.isFinite(automarkTargetWords) || Number(automarkTargetWords) < 0)
    ) {
      return NextResponse.json({ error: "Target word count must be a valid non-negative number." }, { status: 400 });
    }

    const markingMode = MARKING_MODES.includes(markingModeRaw as (typeof MARKING_MODES)[number])
      ? markingModeRaw
      : getDefaultMarkingMode(subject, student.year_group);

    const payload = {
      tutor_id: auth.profile.id,
      student_id: studentId,
      subject,
      title,
      description: description || null,
      due_date: dueDate || null,
      status: "assigned",
      resource_title: resourceTitle || null,
      resource_url: resourceUrl || null,
      year_group: parseYearGroupInt(student.year_group),
      exam_board: examBoard || null,
      unit_id: unitId || null,
      lesson_id: lessonId || null,
      marking_mode: markingMode,
      automark_enabled: automarkEnabled,
      automark_keywords: automarkKeywords,
      automark_target_words: automarkTargetWords
    };

    const { data: created, error } = await auth.supabase
      .from("assignments")
      .insert(payload)
      .select("id,title")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let warning: string | null = null;

    if (attachment) {
      try {
        const admin = createSupabaseAdminClient();
        const { baseName, extension } = getSafeFileParts(attachment.name);
        const path = `${studentId}/${created.id}/${randomUUID()}_${baseName}.${extension}`;
        const bytes = new Uint8Array(await attachment.arrayBuffer());

        const upload = await admin.storage
          .from(ASSIGNMENT_FILES_BUCKET)
          .upload(path, bytes, {
            contentType: attachment.type || "application/octet-stream",
            upsert: false,
            cacheControl: "3600"
          });

        if (upload.error) {
          warning = `Assignment created, but attachment upload failed: ${upload.error.message}`;
        } else {
          const { error: updateError } = await auth.supabase
            .from("assignments")
            .update({
              file_path: path,
              file_url: null
            })
            .eq("id", created.id)
            .eq("tutor_id", auth.profile.id);

          if (updateError) {
            warning = `Assignment created, but attachment could not be linked: ${updateError.message}`;
          }
        }
      } catch (attachmentError) {
        warning = `Assignment created, but attachment upload failed: ${
          attachmentError instanceof Error ? attachmentError.message : "Unknown error"
        }`;
      }
    }

    return NextResponse.json({ ok: true, assignment: created, warning });
  } catch (error) {
    console.error("tutor assignment create failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create assignment." },
      { status: 500 }
    );
  }
}
