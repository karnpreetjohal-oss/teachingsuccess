import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { getTutorManagedStudent } from "@/lib/server/tutor-managed-student";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const { linkId } = await params;
    const admin = createSupabaseAdminClient();

    const { data: link, error: linkError } = await admin
      .from("parent_student_links")
      .select("id,parent_id,student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (linkError || !link) {
      return NextResponse.json({ error: "Parent link not found." }, { status: 404 });
    }

    const student = await getTutorManagedStudent(admin, auth.profile.id, link.student_id);
    if (!student) {
      return NextResponse.json({ error: "You do not have access to this student." }, { status: 403 });
    }

    const { error: deleteError } = await admin.from("parent_student_links").delete().eq("id", linkId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("parent link delete failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove parent link." },
      { status: 500 }
    );
  }
}
