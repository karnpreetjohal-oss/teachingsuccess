import { NextResponse } from "next/server";

import { createStudentSessionToken, getStudentSessionCookieOptions, STUDENT_SESSION_COOKIE } from "@/lib/auth/student-session";
import { firstNameMatches, normalizeAccessCode, verifyStudentPin } from "@/lib/auth/student-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StudentProfile = {
  id: string;
  full_name: string | null;
  year_group: string | null;
  role: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessCode = normalizeAccessCode(String(body?.accessCode || ""));
    const pin = String(body?.pin || "").trim();
    const firstName = String(body?.firstName || "").trim();

    if (!accessCode || !pin) {
      return NextResponse.json({ error: "Access code and PIN are required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("student_access_codes")
      .select(`
        id,
        student_id,
        access_code,
        pin_hash,
        is_active,
        expires_at,
        student:profiles!student_access_codes_student_id_fkey (
          id,
          full_name,
          year_group,
          role
        )
      `)
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Invalid access code or PIN." }, { status: 401 });
    }

    const student = one(data.student as StudentProfile | StudentProfile[] | null | undefined);

    if (!student || student.role !== "student") {
      return NextResponse.json({ error: "Invalid access code or PIN." }, { status: 401 });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This student code has expired. Ask your tutor for a new one." }, { status: 401 });
    }

    if (!firstNameMatches(student.full_name, firstName)) {
      return NextResponse.json({ error: "First-name confirmation did not match." }, { status: 401 });
    }

    if (!verifyStudentPin(pin, data.pin_hash)) {
      return NextResponse.json({ error: "Invalid access code or PIN." }, { status: 401 });
    }

    await supabase
      .from("student_access_codes")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    const token = createStudentSessionToken({
      studentId: student.id,
      role: "student",
      fullName: student.full_name || "Student",
      yearGroup: student.year_group,
      accessCode
    });

    const response = NextResponse.json({
      ok: true,
      student: {
        id: student.id,
        fullName: student.full_name,
        yearGroup: student.year_group
      }
    });

    response.cookies.set(STUDENT_SESSION_COOKIE, token, getStudentSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("student pin login failed", error);
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
