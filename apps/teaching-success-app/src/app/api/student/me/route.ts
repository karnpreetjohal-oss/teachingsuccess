import { NextResponse } from "next/server";

import { getStudentSessionFromCookies } from "@/lib/auth/student-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,year_group,role")
    .eq("id", session.studentId)
    .single();

  if (error || !data || data.role !== "student") {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    student: {
      id: data.id,
      fullName: data.full_name,
      yearGroup: data.year_group
    }
  });
}
