import { NextRequest, NextResponse } from "next/server";

import { hashStudentPin, normalizeAccessCode } from "@/lib/auth/student-access";
import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { getTutorManagedStudent } from "@/lib/server/tutor-managed-student";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    const body = await request.json();
    const accessCode = normalizeAccessCode(String(body?.accessCode || ""));
    const pin = String(body?.pin || "").trim();
    const expiresAt = String(body?.expiresAt || "").trim();
    const rotateExisting = body?.rotateExisting !== false;

    if (!accessCode || !pin) {
      return NextResponse.json({ error: "Access code and PIN are required." }, { status: 400 });
    }

    const student = await getTutorManagedStudent(auth.supabase, auth.profile.id, studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    if (rotateExisting) {
      const { error: deactivateError } = await auth.supabase
        .from("student_access_codes")
        .update({ is_active: false })
        .eq("student_id", studentId)
        .eq("is_active", true);

      if (deactivateError) {
        return NextResponse.json({ error: deactivateError.message }, { status: 400 });
      }
    }

    const { data, error } = await auth.supabase
      .from("student_access_codes")
      .insert({
        student_id: studentId,
        access_code: accessCode,
        pin_hash: hashStudentPin(pin),
        expires_at: expiresAt || null,
        created_by: auth.profile.id
      })
      .select("id,access_code,is_active,expires_at,last_used_at,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, accessCode: data });
  } catch (error) {
    console.error("student access-code create failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create access code." },
      { status: 500 }
    );
  }
}
