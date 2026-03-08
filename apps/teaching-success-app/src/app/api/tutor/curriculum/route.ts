import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { normalizeSubject, parseYearGroupInt } from "@/lib/tutor-helpers";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const studentId = request.nextUrl.searchParams.get("studentId")?.trim() || "";
    const subject = request.nextUrl.searchParams.get("subject")?.trim() || "";
    const examBoardRaw = request.nextUrl.searchParams.get("examBoard")?.trim() || "";

    if (!studentId || !subject) {
      return NextResponse.json({ units: [], lessons: [] });
    }

    const { data: student, error: studentError } = await auth.supabase
      .from("profiles")
      .select("id,role,year_group")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student || student.role !== "student") {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const yearGroup = parseYearGroupInt(student.year_group);
    if (yearGroup === null) {
      return NextResponse.json({ units: [], lessons: [] });
    }

    const { data: units, error: unitError } = await auth.supabase
      .from("curriculum_units")
      .select("id,year_group,subject,exam_board,course,unit_title,unit_order")
      .eq("year_group", yearGroup)
      .order("unit_order", { ascending: true, nullsFirst: false })
      .order("unit_title", { ascending: true });

    if (unitError) {
      return NextResponse.json({ error: unitError.message }, { status: 400 });
    }

    const normalized = normalizeSubject(subject);
    const examBoard = examBoardRaw.toLowerCase();

    const filteredUnits = (units ?? []).filter((unit) => {
      const unitSubject = normalizeSubject(unit.subject);
      if (unitSubject !== normalized) {
        return false;
      }
      if (!examBoard) {
        return true;
      }
      return String(unit.exam_board || "").toLowerCase() === examBoard;
    });

    const unitIds = filteredUnits.map((unit) => unit.id);
    if (!unitIds.length) {
      return NextResponse.json({ units: [], lessons: [] });
    }

    const { data: lessons, error: lessonError } = await auth.supabase
      .from("curriculum_lessons")
      .select("id,unit_id,lesson_title,lesson_order")
      .in("unit_id", unitIds)
      .order("lesson_order", { ascending: true, nullsFirst: false });

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 400 });
    }

    return NextResponse.json({
      units: filteredUnits,
      lessons: lessons ?? []
    });
  } catch (error) {
    console.error("curriculum lookup failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load curriculum." },
      { status: 500 }
    );
  }
}
